from dataclasses import dataclass, field
from datetime import UTC, datetime

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine

from .config import DEFAULT_CONFIG, RecommenderConfig
from .schemas import MovieMetadata

# Positive signals that contribute to the profile.
_POSITIVE_ACTIONS = {"like", "watchlist_add", "rewatch", "watched_long", "share"}
# Negative signals that push genres down.
_NEGATIVE_ACTIONS = {"dislike", "skip_fast"}

# Cap how many liked-film overviews we keep per user (oldest drop off).
_MAX_OVERVIEW_HISTORY = 50


@dataclass
class UserProfile:
    user_id: str
    interaction_count: int = 0

    # Cumulative weights per TMDB genre/actor/director/keyword ID.
    # Positive = liked, negative = disliked. Used both for TMDB parameter
    # translation (tmdb_bridge) and for genre cosine similarity (content_score).
    genre_weights: dict[int, float] = field(default_factory=dict)
    actor_weights: dict[int, float] = field(default_factory=dict)
    director_weights: dict[int, float] = field(default_factory=dict)
    keyword_weights: dict[int, float] = field(default_factory=dict)

    # Overviews of liked films — used to build the user's TF-IDF representation.
    # Capped at _MAX_OVERVIEW_HISTORY entries (FIFO eviction).
    liked_overviews: list[str] = field(default_factory=list)

    # Running average vote_average of liked films — Discover lower-bound filter.
    avg_vote: float = 0.0

    # Serialization handle for DB persistence (future). None until first interaction.
    # Not used in content_score — genre_weights / liked_overviews are the live state.
    feature_vector: np.ndarray | None = None

    last_updated: datetime = field(default_factory=lambda: datetime.now(UTC))


class ContentBasedFilter:
    """In-RAM profile cache. Loaded from DB on startup; written back on every update."""

    def __init__(self, config: RecommenderConfig = DEFAULT_CONFIG) -> None:
        self._cfg = config
        self._profiles: dict[str, UserProfile] = {}

    # ------------------------------------------------------------------
    # ContentFilter Protocol
    # ------------------------------------------------------------------

    def get_profile(self, user_id: str) -> UserProfile:
        if user_id not in self._profiles:
            self._profiles[user_id] = UserProfile(user_id=user_id)
        return self._profiles[user_id]

    def content_score(self, profile: UserProfile, candidates: list[MovieMetadata]) -> np.ndarray:
        """
        β · genre_cosine + (1 - β) · overview_tfidf for each candidate.

        Either component is zero when the profile has no data for it (cold-start or
        no liked overviews yet). The engine's alpha blending handles the true cold-start
        fallback — this method just returns the best signal available.
        """
        if not candidates:
            return np.zeros(0)
        if not profile.genre_weights and not profile.liked_overviews:
            return np.zeros(len(candidates))

        genre_scores = self._genre_similarity(profile, candidates)
        overview_scores = self._overview_similarity(profile, candidates)
        return self._cfg.beta * genre_scores + (1.0 - self._cfg.beta) * overview_scores

    def update_profile(
        self,
        user_id: str,
        movie_id: int,
        action: str,
        lambda_decay: float,
        metadata: MovieMetadata | None = None,
    ) -> None:
        """
        Incrementally update the profile after an interaction.

        When metadata is available (engine passes it from the movie cache), genre
        weights and the liked-overview list are updated immediately. When metadata
        is absent (movie wasn't in a recent feed cache), only the interaction count
        is incremented — a known gap until full DB integration lands.
        """
        profile = self.get_profile(user_id)
        profile.interaction_count += 1
        profile.last_updated = datetime.now(UTC)

        if metadata is not None:
            if action in _POSITIVE_ACTIONS:
                for gid in metadata.genre_ids:
                    profile.genre_weights[gid] = profile.genre_weights.get(gid, 0.0) + 1.0
                for aid in metadata.cast_ids:
                    profile.actor_weights[aid] = profile.actor_weights.get(aid, 0.0) + 1.0
                for did in metadata.director_ids:
                    profile.director_weights[did] = profile.director_weights.get(did, 0.0) + 1.0
                for kid in metadata.keyword_ids:
                    profile.keyword_weights[kid] = profile.keyword_weights.get(kid, 0.0) + 1.0
                if metadata.overview.strip():
                    profile.liked_overviews.append(metadata.overview)
                    if len(profile.liked_overviews) > _MAX_OVERVIEW_HISTORY:
                        profile.liked_overviews = profile.liked_overviews[-_MAX_OVERVIEW_HISTORY:]
                if metadata.vote_average > 0:
                    n = profile.interaction_count
                    profile.avg_vote = (profile.avg_vote * (n - 1) + metadata.vote_average) / n
            elif action in _NEGATIVE_ACTIONS:
                for gid in metadata.genre_ids:
                    profile.genre_weights[gid] = profile.genre_weights.get(gid, 0.0) - 0.5

            # Mark profile as initialised for the DB serialisation path.
            if profile.genre_weights:
                profile.feature_vector = np.ones(1)

        self._profiles[user_id] = profile

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def load(self, db) -> None:  # type: ignore[type-arg]
        """Populate the in-RAM cache from DB on service startup. TODO: implement once schema is confirmed."""
        pass

    # ------------------------------------------------------------------
    # Scoring helpers
    # ------------------------------------------------------------------

    def _genre_similarity(
        self, profile: UserProfile, candidates: list[MovieMetadata]
    ) -> np.ndarray:
        """
        Cosine similarity between the user's genre weight vector and each candidate's
        binary genre vector. Negative weights (from dislikes) push scores below zero.
        """
        if not profile.genre_weights:
            return np.zeros(len(candidates))

        # Joint vocabulary: genres present in the profile + all candidate genres.
        all_genre_ids: set[int] = set(profile.genre_weights.keys())
        for c in candidates:
            all_genre_ids.update(c.genre_ids)
        vocab = sorted(all_genre_ids)
        idx = {gid: i for i, gid in enumerate(vocab)}

        # User vector — may contain negative values for disliked genres.
        u = np.array([profile.genre_weights.get(gid, 0.0) for gid in vocab])
        u_norm = np.linalg.norm(u)
        if u_norm == 0.0:
            return np.zeros(len(candidates))
        u_unit = u / u_norm

        # Candidate matrix — binary: 1 if the genre appears in the film.
        C = np.zeros((len(candidates), len(vocab)))
        for i, c in enumerate(candidates):
            for gid in c.genre_ids:
                if gid in idx:
                    C[i, idx[gid]] = 1.0

        # Row-normalise (zero rows stay zero — genres-unknown films score 0).
        norms = np.linalg.norm(C, axis=1, keepdims=True)
        norms[norms == 0.0] = 1.0
        C_unit = C / norms

        # Cosine similarity = dot product of unit vectors.
        return C_unit @ u_unit

    def _overview_similarity(
        self, profile: UserProfile, candidates: list[MovieMetadata]
    ) -> np.ndarray:
        """
        TF-IDF cosine similarity between a user pseudo-document (concatenation of
        liked overviews) and each candidate's overview.

        The vectorizer is fitted on the candidate pool only (per architecture spec —
        lightweight, no persistent index). The user document is then transformed
        against that vocabulary; OOV terms are silently dropped.
        """
        if not profile.liked_overviews:
            return np.zeros(len(candidates))

        candidate_overviews = [c.overview for c in candidates]
        non_empty_overviews = [t for t in candidate_overviews if t.strip()]
        if not non_empty_overviews:
            return np.zeros(len(candidates))

        user_doc = " ".join(profile.liked_overviews)

        try:
            vectorizer = TfidfVectorizer(
                stop_words="english",
                sublinear_tf=True,
                min_df=1,
            )
            # Fit vocabulary on the candidate pool only.
            vectorizer.fit(non_empty_overviews)
            # Transform both sets (empty candidate overviews → zero vector).
            candidate_vecs = vectorizer.transform(candidate_overviews)
            user_vec = vectorizer.transform([user_doc])
            scores: np.ndarray = sklearn_cosine(user_vec, candidate_vecs).flatten()
            return scores
        except ValueError:
            # Vocabulary empty after stop-word removal.
            return np.zeros(len(candidates))
