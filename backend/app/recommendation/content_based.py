from dataclasses import dataclass, field
from datetime import datetime

import numpy as np

from .config import DEFAULT_CONFIG, RecommenderConfig


@dataclass
class UserProfile:
    user_id: str
    interaction_count: int = 0

    # Weighted average of liked-film feature vectors (genres + cast + keywords).
    # None until the user has at least one interaction — triggers cold-start in the engine.
    feature_vector: np.ndarray | None = None

    # Cumulative weights per TMDB ID — used by TMDBBridge for parameter translation.
    genre_weights: dict[int, float] = field(default_factory=dict)
    actor_weights: dict[int, float] = field(default_factory=dict)
    director_weights: dict[int, float] = field(default_factory=dict)

    # Average vote_average of liked films — used as lower bound in TMDB Discover filter.
    avg_vote: float = 0.0

    last_updated: datetime = field(default_factory=datetime.utcnow)


class ContentBasedFilter:
    """In-RAM profile cache; profiles are loaded from DB on startup and written back on every update."""

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

    def content_score(self, profile: UserProfile, candidate_ids: list[int]) -> np.ndarray:
        """Cosine similarity between the user profile vector and each candidate. Shape: (n,)."""
        if profile.feature_vector is None:
            # No interactions yet — engine handles this via cold-start alpha override
            return np.zeros(len(candidate_ids))

        # TODO: fetch feature vectors for candidate_ids (genres + cast + keywords from TMDB)
        # TODO: cosine_similarity(profile.feature_vector, candidate_matrix)  → content_vec_scores
        # TODO: build TF-IDF on candidate overviews, compute overview similarity            → overview_scores
        # TODO: return config.beta * content_vec_scores + (1 - config.beta) * overview_scores
        return np.zeros(len(candidate_ids))

    def update_profile(
        self, user_id: str, movie_id: int, action: str, lambda_decay: float
    ) -> None:
        """Incrementally update the profile vector after an interaction (exponential time decay)."""
        profile = self.get_profile(user_id)
        profile.interaction_count += 1
        profile.last_updated = datetime.utcnow()

        # TODO: fetch feature vector for movie_id from TMDB
        # TODO: recompute profile.feature_vector as decay-weighted average over all liked films
        #       weight = exp(-lambda_decay * age_days); dislike interactions subtract
        # TODO: update genre_weights, actor_weights, director_weights from the movie's metadata
        # TODO: persist to DB (user_profiles table)

        self._profiles[user_id] = profile

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def load(self, db) -> None:  # type: ignore[type-arg]
        """Populate the in-RAM cache from DB on service startup. TODO: implement once schema is confirmed."""
        pass
