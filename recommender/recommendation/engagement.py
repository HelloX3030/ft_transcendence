from collections import defaultdict

from .config import DEFAULT_CONFIG, RecommenderConfig
from .schemas import ScoredMovie

# Maps each action literal to its config attribute name.
_ACTION_TO_FIELD: dict[str, str] = {
    "like": "signal_like",
    "dislike": "signal_dislike",
    "watchlist_add": "signal_watchlist_add",
    "skip_fast": "signal_skip_fast",
    "watched_long": "signal_watched_long",
    "rewatch": "signal_rewatch",
    "share": "signal_share",
}


class EngagementTracker:
    """
    Accumulates real-time engagement deltas in RAM and applies them to candidate scores.

    Deltas persist for the lifetime of the service process. They represent recency signals
    that haven't yet been fully absorbed into the persisted profile vector, on restart the
    profile vector (loaded from DB) already captures past interactions, so nothing is lost.
    """

    def __init__(self, config: RecommenderConfig = DEFAULT_CONFIG) -> None:
        self._cfg = config
        # {user_id: {movie_id: accumulated_delta}}
        self._deltas: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))

    def record_action(
        self,
        user_id: str,
        movie_id: int,
        action: str,
        watch_time: float | None = None,  # noqa: ARG002  (passed through; classification is upstream)
    ) -> None:
        """Accumulate the delta score for an interaction. Unknown actions are silently ignored."""
        field = _ACTION_TO_FIELD.get(action)
        if field is None:
            return
        self._deltas[user_id][movie_id] += getattr(self._cfg, field)

    def apply_signals(self, user_id: str, candidates: list[ScoredMovie]) -> list[ScoredMovie]:
        """Add accumulated engagement deltas to the scores of any matching candidates."""
        user_deltas = self._deltas.get(user_id)
        if not user_deltas:
            return candidates
        return [
            ScoredMovie(movie_id=m.movie_id, score=m.score + user_deltas.get(m.movie_id, 0.0))
            for m in candidates
        ]
