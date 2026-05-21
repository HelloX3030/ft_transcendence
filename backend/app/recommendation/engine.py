from typing import Protocol

import numpy as np

from .config import DEFAULT_CONFIG, RecommenderConfig
from .schemas import ScoredMovie


# ---------------------------------------------------------------------------
# Module interfaces
# Each concrete module must structurally satisfy its Protocol — no inheritance
# required. Swap implementations freely as long as the shape matches.
# ---------------------------------------------------------------------------


class UserProfile(Protocol):
    """Minimal view of a user's state that the engine needs directly."""

    user_id: str
    interaction_count: int


class ContentFilter(Protocol):
    def get_profile(self, user_id: str) -> UserProfile: ...
    def content_score(self, profile: UserProfile, candidate_ids: list[int]) -> np.ndarray: ...
    def update_profile(
        self, user_id: str, movie_id: int, action: str, lambda_decay: float
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
    def apply(self, user_id: str, candidates: list[ScoredMovie]) -> list[ScoredMovie]: ...


class TMDBBridge(Protocol):
    def profile_to_params(self, profile: UserProfile, diversify: bool) -> dict: ...
    def fetch_candidates(self, params: dict, exclude: list[int]) -> list[int]: ...


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------


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

    def get_feed(
        self,
        user_id: str,
        limit: int = 10,
        seen_ids: list[int] | None = None,
    ) -> list[ScoredMovie]:
        seen = seen_ids or []

        profile = self._content.get_profile(user_id)

        diversify = self._diversifier.should_diversify(user_id)
        tmdb_params = self._tmdb.profile_to_params(profile, diversify=diversify)
        candidate_ids = self._tmdb.fetch_candidates(tmdb_params, exclude=seen)

        scored = self._hybrid_score(user_id, candidate_ids, profile)
        scored = self._engagement.apply_signals(user_id, scored)
        scored = self._diversifier.apply(user_id, scored)

        scored.sort(key=lambda m: m.score, reverse=True)
        return scored[:limit]

    def record_signal(
        self,
        user_id: str,
        movie_id: int,
        action: str,
        watch_time: float | None = None,
    ) -> None:
        self._content.update_profile(user_id, movie_id, action, self._cfg.lambda_decay)
        self._engagement.record_action(user_id, movie_id, action, watch_time)

    # ------------------------------------------------------------------

    def _hybrid_score(
        self,
        user_id: str,
        candidate_ids: list[int],
        profile: UserProfile,
    ) -> list[ScoredMovie]:
        alpha = self._effective_alpha(profile)

        content_scores = self._content.content_score(profile, candidate_ids)
        collab_scores = self._collab.predict(user_id, candidate_ids)

        blended = alpha * content_scores + (1.0 - alpha) * collab_scores

        return [
            ScoredMovie(movie_id=mid, score=float(score))
            for mid, score in zip(candidate_ids, blended)
        ]

    def _effective_alpha(self, profile: UserProfile) -> float:
        """Cold-start: content-only until the user has enough interactions for CF."""
        if profile.interaction_count < self._cfg.hybrid_threshold:
            return 1.0
        return self._cfg.alpha
