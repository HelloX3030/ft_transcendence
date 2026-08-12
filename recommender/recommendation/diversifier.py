import math
import random
from collections import defaultdict, deque

from .config import DEFAULT_CONFIG, RecommenderConfig
from .schemas import ScoredMovie

# How many recently served batches to inspect for genre dominance.
_HISTORY_WINDOW = 10
# Fraction of a single genre ID across the window that triggers diversification.
_DOMINANCE_RATIO = 0.6


class Diversifier:
    """
    Anti-filter-bubble layer. Tracks per-user genre history across recent feeds,
    triggers a diversification boost when one genre dominates, and applies a
    freshness decay boost when movie age data is available.
    """

    def __init__(self, config: RecommenderConfig = DEFAULT_CONFIG) -> None:
        self._cfg = config
        # {user_id: deque of genre-id lists, one per served batch}
        self._genre_history: dict[str, deque[list[int]]] = defaultdict(
            lambda: deque(maxlen=_HISTORY_WINDOW)
        )
        # Cached diversify decision for the current in-flight request.
        # Set by should_diversify(), consumed (and cleared) by apply().
        self._pending: dict[str, bool] = {}

    # ------------------------------------------------------------------
    # Diversifier Protocol
    # ------------------------------------------------------------------

    def should_diversify(self, user_id: str) -> bool:
        """
        Return True if one genre makes up >= _DOMINANCE_RATIO of recently served genres.
        No history → False (cold users get the regular feed).
        """
        flat = [gid for batch in self._genre_history[user_id] for gid in batch]
        if not flat:
            self._pending[user_id] = False
            return False

        counts: dict[int, int] = {}
        for gid in flat:
            counts[gid] = counts.get(gid, 0) + 1
        dominant_fraction = max(counts.values()) / len(flat)

        result = dominant_fraction >= _DOMINANCE_RATIO
        self._pending[user_id] = result
        return result

    def apply(
        self,
        user_id: str,
        candidates: list[ScoredMovie],
        movie_ages: dict[int, float] | None = None,
    ) -> list[ScoredMovie]:
        """
        Apply freshness and diversification boosts to the candidate list.

        Args:
            user_id:    User being served.
            candidates: Scored candidates from hybrid + engagement steps.
            movie_ages: {movie_id: days_since_release}. Freshness term is skipped when absent.
                        Wired up once TMDB data flows through the pipeline.
        """
        if not candidates:
            return candidates

        updated = list(candidates)

        # Freshness boost: delta * exp(-mu * age_days)
        if movie_ages:
            updated = [
                ScoredMovie(
                    movie_id=m.movie_id,
                    score=m.score
                    + self._cfg.delta * math.exp(-self._cfg.mu_decay * movie_ages.get(m.movie_id, 0.0)),
                )
                for m in updated
            ]

        # Diversification gamma boost: one random candidate gets a flat gamma bump.
        # The TMDB bridge already excluded the dominant genre from the candidate pool
        # when should_diversify() returned True, so any pick here is a valid diversity choice.
        if self._pending.pop(user_id, False):
            idx = random.randrange(len(updated))
            m = updated[idx]
            updated[idx] = ScoredMovie(movie_id=m.movie_id, score=m.score + self._cfg.gamma)

        return updated

    # ------------------------------------------------------------------
    # Feed tracking
    # ------------------------------------------------------------------

    def record_served(self, user_id: str, genre_ids: list[int]) -> None:
        """
        Record the genre IDs present in a served feed batch.
        Call this after delivering a feed response to keep the history current.
        Wired up in the engine once TMDB genre data is available.
        """
        self._genre_history[user_id].append(genre_ids)
