from datetime import date
from typing import Protocol

import numpy as np

from .config import DEFAULT_CONFIG, RecommenderConfig
from .schemas import MovieMetadata, ScoredMovie


# Each concrete module must structurally satisfy its Protocol, no inheritance
# required. Swap implementations freely as long as the shape matches.


class UserProfile(Protocol):
    """Minimal view of a user's state that the engine needs directly."""

    user_id: str
    interaction_count: int


class ContentFilter(Protocol):
    def get_profile(self, user_id: str) -> UserProfile: ...
    def content_score(self, profile: UserProfile, candidates: list[MovieMetadata]) -> np.ndarray: ...
    def update_profile(
        self,
        user_id: str,
        movie_id: int,
        action: str,
        lambda_decay: float,
        metadata: MovieMetadata | None = None,
    ) -> None: ...


class CollaborativeFilter(Protocol):
    def predict(self, user_id: str, candidate_ids: list[int]) -> np.ndarray: ...


class EngagementTracker(Protocol):
    def apply_signals(self, user_id: str, candidates: list[ScoredMovie]) -> list[ScoredMovie]: ...
    def record_action(
        self, user_id: str, movie_id: int, action: str, watch_time: float | None = None
    ) -> None: ...


class Diversifier(Protocol):
    def should_diversify(self, user_id: str) -> bool: ...
    def apply(
        self,
        user_id: str,
        candidates: list[ScoredMovie],
        movie_ages: dict[int, float] | None = None,
    ) -> list[ScoredMovie]: ...
    def record_served(self, user_id: str, genre_ids: list[int]) -> None: ...


class TMDBBridge(Protocol):
    def profile_to_query_plan(
        self, profile: UserProfile, diversify: bool, cursor: int = 0
    ) -> list[dict]: ...
    async def fetch_candidates(
        self, plan: list[dict], exclude: list[int], min_pool: int = 20
    ) -> list[MovieMetadata]: ...
    async def fetch_movie_detail(self, movie_id: int) -> MovieMetadata: ...


# Ordering for the unconstrained fallback query. Popularity, because if we know
# nothing useful about what fits this user, what fits most people is the best guess.
_FALLBACK_SORT = "popularity.desc"

# Actions that warrant a TMDB detail fetch to enrich cast/director/keyword weights.
_DETAIL_ACTIONS: frozenset[str] = frozenset({"like", "watchlist_add", "rewatch", "watched_long", "share"})


def _compute_movie_ages(candidates: list[MovieMetadata]) -> dict[int, float]:
    """Days since release for each candidate that has a valid release_date."""
    today = date.today()
    ages: dict[int, float] = {}
    for m in candidates:
        if m.release_date:
            try:
                rd = date.fromisoformat(m.release_date)
                ages[m.tmdb_id] = float((today - rd).days)
            except ValueError:
                pass
    return ages


class RecommenderEngine:
    """
    Orchestrates the full recommendation pipeline.
    All algorithm logic lives in the injected modules; the engine only wires them.
    """

    def __init__(
        self,
        content_filter: ContentFilter,
        collab_filter: CollaborativeFilter,
        engagement_tracker: EngagementTracker,
        diversifier: Diversifier,
        tmdb_bridge: TMDBBridge,
        config: RecommenderConfig = DEFAULT_CONFIG,
    ) -> None:
        self._content = content_filter
        self._collab = collab_filter
        self._engagement = engagement_tracker
        self._diversifier = diversifier
        self._tmdb = tmdb_bridge
        self._cfg = config
        # In-RAM movie metadata cache: populated on each feed fetch, read on each signal.
        self._movie_cache: dict[int, MovieMetadata] = {}
        # Tracks which movie IDs have had their detail fetched (cast/keywords/directors).
        # Prevents repeated detail calls for the same film within one service lifetime.
        self._detail_fetched: set[int] = set()

    async def get_feed(
        self,
        user_id: str,
        limit: int = 10,
        seen_ids: list[int] | None = None,
        cursor: int = 0,
    ) -> list[ScoredMovie]:
        seen = seen_ids or []

        profile = self._content.get_profile(user_id)

        diversify = self._diversifier.should_diversify(user_id)
        effective_cursor = self._effective_cursor(cursor, len(seen), limit)
        plan = self._tmdb.profile_to_query_plan(
            profile, diversify=diversify, cursor=effective_cursor
        )
        candidates = await self._tmdb.fetch_candidates(
            plan, exclude=seen, min_pool=limit * self._cfg.min_pool_ratio
        )

        if not candidates:
            candidates = await self._fallback_candidates(profile, seen, limit, effective_cursor)

        # Cache metadata so record_signal can update the profile without an extra TMDB call.
        for m in candidates:
            self._movie_cache[m.tmdb_id] = m

        movie_ages = _compute_movie_ages(candidates)

        scored = self._hybrid_score(user_id, candidates, profile)
        scored = self._engagement.apply_signals(user_id, scored)
        scored = self._diversifier.apply(user_id, scored, movie_ages=movie_ages)

        scored.sort(key=lambda m: m.score, reverse=True)
        top = scored[:limit]

        # Record genres of served films (top-N) for diversification history.
        served_ids = {m.movie_id for m in top}
        served_genres = [
            gid for m in candidates if m.tmdb_id in served_ids for gid in m.genre_ids
        ]
        self._diversifier.record_served(user_id, served_genres)

        return top

    async def record_signal(
        self,
        user_id: str,
        movie_id: int,
        action: str,
        watch_time: float | None = None,
    ) -> None:
        metadata = self._movie_cache.get(movie_id)

        # For positive signals, enrich the cached metadata with cast/director/keyword
        # data from the TMDB detail endpoint, but only once per movie per process lifetime.
        if action in _DETAIL_ACTIONS and movie_id not in self._detail_fetched:
            self._detail_fetched.add(movie_id)
            try:
                detailed = await self._tmdb.fetch_movie_detail(movie_id)
                self._movie_cache[movie_id] = detailed
                metadata = detailed
            except Exception:
                pass  # detail fetch failed, fall back to genre-only profile update

        self._content.update_profile(user_id, movie_id, action, self._cfg.lambda_decay, metadata)
        self._engagement.record_action(user_id, movie_id, action, watch_time)

    def _hybrid_score(
        self,
        user_id: str,
        candidates: list[MovieMetadata],
        profile: UserProfile,
    ) -> list[ScoredMovie]:
        alpha = self._effective_alpha(profile)
        candidate_ids = [m.tmdb_id for m in candidates]

        content_scores = self._content.content_score(profile, candidates)
        collab_scores = self._collab.predict(user_id, candidate_ids)

        blended = alpha * content_scores + (1.0 - alpha) * collab_scores

        return [
            ScoredMovie(movie_id=mid, score=float(score))
            for mid, score in zip(candidate_ids, blended)
        ]

    def _effective_cursor(self, requested: int, seen_count: int, limit: int) -> int:
        """
        How far to advance the candidate window for this request.

        The caller's cursor covers repeated calls inside one browsing session,
        before any of them have produced a signal. Watch history covers the
        rest: a user who has already reacted to 200 films should not be shown
        the window they started from, whatever cursor the caller sends. Taking
        both means the feed keeps moving even if a caller never sends a cursor
        at all (issue #249).
        """
        consumed = seen_count // max(limit, 1)
        return max(requested, 0) + consumed

    async def _fallback_candidates(
        self,
        profile: UserProfile,
        seen: list[int],
        limit: int,
        cursor: int,
    ) -> list[MovieMetadata]:
        """
        Last resort when the profile's own queries come back empty.

        Returning an empty feed is never the right answer: the user is looking
        at a blank screen, and "we have nothing for you" is worse than a
        merely unpersonalised suggestion. Retry unconstrained by taste, keeping
        only the exclusion list, so there is always something to show.
        """
        bare = [{
            "sort_by": _FALLBACK_SORT,
            "vote_count.gte": self._cfg.tmdb_min_vote_count,
            "page": cursor + 1,
        }]
        try:
            return await self._tmdb.fetch_candidates(
                bare, exclude=seen, min_pool=limit
            )
        except Exception:
            return []

    def _effective_alpha(self, profile: UserProfile) -> float:
        """Cold-start: content-only until the user has enough interactions for CF."""
        if profile.interaction_count < self._cfg.hybrid_threshold:
            return 1.0
        return self._cfg.alpha
