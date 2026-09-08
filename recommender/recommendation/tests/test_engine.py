import numpy as np
import pytest

from recommendation.config import RecommenderConfig
from recommendation.engine import RecommenderEngine
from recommendation.schemas import MovieMetadata, ScoredMovie

CFG = RecommenderConfig()


class _Profile:
    def __init__(self, user_id: str = "u1", interaction_count: int = 0) -> None:
        self.user_id = user_id
        self.interaction_count = interaction_count


class _FakeContent:
    def get_profile(self, user_id: str) -> _Profile:
        return _Profile(user_id)

    def content_score(self, profile, candidates: list[MovieMetadata]) -> np.ndarray:
        # Descending scores, so ordering is predictable in assertions.
        return np.linspace(1.0, 0.0, num=len(candidates)) if candidates else np.array([])

    def update_profile(self, user_id, movie_id, action, lambda_decay, metadata=None) -> None:
        pass


class _FakeCollab:
    def predict(self, user_id: str, candidate_ids: list[int]) -> np.ndarray:
        return np.zeros(len(candidate_ids))


class _FakeEngagement:
    def apply_signals(self, user_id: str, candidates: list[ScoredMovie]) -> list[ScoredMovie]:
        return candidates

    def record_action(self, user_id, movie_id, action, watch_time=None) -> None:
        pass


class _FakeDiversifier:
    def should_diversify(self, user_id: str) -> bool:
        return False

    def apply(self, user_id, candidates, movie_ages=None):
        return candidates

    def record_served(self, user_id, genre_ids) -> None:
        pass


class _RecordingBridge:
    """Records the cursor it was asked for and the plans it was handed."""

    def __init__(self, pool: list[MovieMetadata] | None = None) -> None:
        self.pool = pool if pool is not None else []
        self.cursors: list[int] = []
        self.plans: list[list[dict]] = []

    def profile_to_query_plan(self, profile, diversify: bool, cursor: int = 0) -> list[dict]:
        self.cursors.append(cursor)
        return [{"with_genres": "28", "page": cursor + 1, "sort_by": "popularity.desc"}]

    async def fetch_candidates(self, plan, exclude, min_pool: int = 20):
        self.plans.append(plan)
        excluded = set(exclude)
        return [m for m in self.pool if m.tmdb_id not in excluded]

    async def fetch_movie_detail(self, movie_id: int) -> MovieMetadata:
        return MovieMetadata(tmdb_id=movie_id)


def _engine(bridge: _RecordingBridge) -> RecommenderEngine:
    return RecommenderEngine(
        content_filter=_FakeContent(),
        collab_filter=_FakeCollab(),
        engagement_tracker=_FakeEngagement(),
        diversifier=_FakeDiversifier(),
        tmdb_bridge=bridge,
        config=CFG,
    )


def _pool(n: int, start: int = 1) -> list[MovieMetadata]:
    return [MovieMetadata(tmdb_id=i, genre_ids=[28]) for i in range(start, start + n)]


# ---------------------------------------------------------------------------
# Cursor derivation (issue #249)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_requested_cursor_reaches_the_bridge():
    bridge = _RecordingBridge(_pool(5))
    await _engine(bridge).get_feed("u1", limit=5, cursor=3)

    assert bridge.cursors == [3]


@pytest.mark.asyncio
async def test_watch_history_advances_the_cursor_without_a_caller_cursor():
    # 40 films already seen at 10 per feed: four feeds consumed.
    bridge = _RecordingBridge(_pool(5, start=100))
    await _engine(bridge).get_feed("u1", limit=10, seen_ids=list(range(40)))

    assert bridge.cursors == [4]


@pytest.mark.asyncio
async def test_caller_cursor_and_watch_history_compound():
    bridge = _RecordingBridge(_pool(5, start=100))
    await _engine(bridge).get_feed("u1", limit=10, seen_ids=list(range(20)), cursor=3)

    assert bridge.cursors == [5]  # 3 requested + 2 consumed


@pytest.mark.asyncio
async def test_negative_cursor_is_floored_at_zero():
    bridge = _RecordingBridge(_pool(5))
    await _engine(bridge).get_feed("u1", limit=10, cursor=-7)

    assert bridge.cursors == [0]


# ---------------------------------------------------------------------------
# Exhaustion fallback (issue #249): a feed must never come back empty
# ---------------------------------------------------------------------------


class _EmptyThenFallbackBridge(_RecordingBridge):
    """The taste-driven plan finds nothing; the unconstrained retry finds films."""

    async def fetch_candidates(self, plan, exclude, min_pool: int = 20):
        self.plans.append(plan)
        if "with_genres" in plan[0]:
            return []
        excluded = set(exclude)
        return [m for m in _pool(6, start=500) if m.tmdb_id not in excluded]


@pytest.mark.asyncio
async def test_empty_profile_pool_falls_back_to_an_unconstrained_query():
    bridge = _EmptyThenFallbackBridge()
    feed = await _engine(bridge).get_feed("u1", limit=3)

    assert len(feed) == 3
    # Second attempt dropped every taste constraint but kept the vote floor.
    fallback = bridge.plans[1][0]
    assert "with_genres" not in fallback
    assert fallback["vote_count.gte"] == CFG.tmdb_min_vote_count


@pytest.mark.asyncio
async def test_fallback_still_respects_the_seen_list():
    bridge = _EmptyThenFallbackBridge()
    feed = await _engine(bridge).get_feed("u1", limit=10, seen_ids=[500, 501])

    assert {m.movie_id for m in feed}.isdisjoint({500, 501})


class _AlwaysEmptyBridge(_RecordingBridge):
    async def fetch_candidates(self, plan, exclude, min_pool: int = 20):
        self.plans.append(plan)
        return []


@pytest.mark.asyncio
async def test_fallback_that_also_finds_nothing_returns_an_empty_feed():
    bridge = _AlwaysEmptyBridge()
    feed = await _engine(bridge).get_feed("u1", limit=5)

    assert feed == []
    assert len(bridge.plans) == 2  # tried, then tried again unconstrained


class _RaisingFallbackBridge(_RecordingBridge):
    async def fetch_candidates(self, plan, exclude, min_pool: int = 20):
        self.plans.append(plan)
        if "with_genres" in plan[0]:
            return []
        raise RuntimeError("TMDB down")


@pytest.mark.asyncio
async def test_failing_fallback_does_not_propagate():
    bridge = _RaisingFallbackBridge()

    assert await _engine(bridge).get_feed("u1", limit=5) == []


@pytest.mark.asyncio
async def test_fallback_is_skipped_when_the_plan_already_found_films():
    bridge = _RecordingBridge(_pool(4))
    await _engine(bridge).get_feed("u1", limit=2)

    assert len(bridge.plans) == 1
