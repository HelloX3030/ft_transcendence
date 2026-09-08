import asyncio

import pytest

from recommendation.retrain import MIN_INTERACTIONS, RetrainResult, Retrainer


def _rows(n: int, users: int = 5, movies: int = 5) -> list[tuple[str, int, float]]:
    """n interaction rows spread over `users` users and `movies` movies."""
    return [(f"u{i % users}", 100 + (i % movies), 1.0) for i in range(n)]


class _FakeDB:
    def __init__(self, rows=None, error: Exception | None = None) -> None:
        self._rows = rows if rows is not None else []
        self._error = error
        self.calls = 0

    async def fetch_interactions(self):
        self.calls += 1
        if self._error:
            raise self._error
        return self._rows


class _FakeCollab:
    def __init__(self, error: Exception | None = None) -> None:
        self._error = error
        self.trained_with: list | None = None

    def train(self, interactions) -> None:
        if self._error:
            raise self._error
        self.trained_with = interactions


# ---------------------------------------------------------------------------
# The happy path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_trains_and_reports_the_shape_of_the_data():
    db, collab = _FakeDB(_rows(40)), _FakeCollab()

    result = await Retrainer(db=db, collab=collab).run()

    assert result.status == "trained"
    assert result.interactions == 40
    assert result.users == 5
    assert result.movies == 5
    assert collab.trained_with is not None
    assert result.duration_seconds >= 0.0


@pytest.mark.asyncio
async def test_last_result_is_kept_for_the_next_caller():
    retrainer = Retrainer(db=_FakeDB(_rows(40)), collab=_FakeCollab())
    assert retrainer.last_result is None

    await retrainer.run()

    assert retrainer.last_result is not None
    assert retrainer.last_result.status == "trained"


# ---------------------------------------------------------------------------
# Refusing to make the model worse
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_skips_an_empty_database_without_touching_the_checkpoint():
    collab = _FakeCollab()

    result = await Retrainer(db=_FakeDB([]), collab=collab).run()

    assert result.status == "skipped"
    assert collab.trained_with is None  # the existing checkpoint survives


@pytest.mark.asyncio
async def test_skips_when_there_are_too_few_interactions():
    collab = _FakeCollab()

    result = await Retrainer(db=_FakeDB(_rows(MIN_INTERACTIONS - 1)), collab=collab).run()

    assert result.status == "skipped"
    assert collab.trained_with is None


@pytest.mark.asyncio
async def test_skips_when_plenty_of_rows_come_from_too_few_users():
    # 40 rows, but one user: svds needs k < min(n_users, n_movies).
    collab = _FakeCollab()

    result = await Retrainer(db=_FakeDB(_rows(40, users=1)), collab=collab).run()

    assert result.status == "skipped"
    assert result.users == 1
    assert collab.trained_with is None


@pytest.mark.asyncio
async def test_skips_when_plenty_of_rows_cover_too_few_movies():
    collab = _FakeCollab()

    result = await Retrainer(db=_FakeDB(_rows(40, movies=2)), collab=collab).run()

    assert result.status == "skipped"
    assert collab.trained_with is None


# ---------------------------------------------------------------------------
# Failures are reported, never raised at the caller
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_database_failure_is_reported_not_raised():
    result = await Retrainer(
        db=_FakeDB(error=RuntimeError("connection reset")), collab=_FakeCollab()
    ).run()

    assert result.status == "failed"
    assert "connection reset" in result.detail


@pytest.mark.asyncio
async def test_a_fit_failure_is_reported_not_raised():
    result = await Retrainer(
        db=_FakeDB(_rows(40)), collab=_FakeCollab(error=ValueError("singular matrix"))
    ).run()

    assert result.status == "failed"
    assert "singular matrix" in result.detail
    assert result.interactions == 40  # the counts it got to are still reported


@pytest.mark.asyncio
async def test_the_running_flag_is_cleared_after_a_failure():
    retrainer = Retrainer(db=_FakeDB(error=RuntimeError("boom")), collab=_FakeCollab())

    await retrainer.run()

    assert retrainer.running is False  # a failed run must not wedge the endpoint


# ---------------------------------------------------------------------------
# One at a time
# ---------------------------------------------------------------------------


class _SlowDB(_FakeDB):
    def __init__(self, rows):
        super().__init__(rows)
        self.started = asyncio.Event()
        self.release = asyncio.Event()

    async def fetch_interactions(self):
        self.calls += 1
        self.started.set()
        await self.release.wait()
        return self._rows


@pytest.mark.asyncio
async def test_a_second_retrain_is_refused_while_one_is_running():
    db = _SlowDB(_rows(40))
    retrainer = Retrainer(db=db, collab=_FakeCollab())

    first = asyncio.create_task(retrainer.run())
    await db.started.wait()

    second = await retrainer.run()          # arrives mid-flight
    assert second.status == "skipped"
    assert "already running" in second.detail
    assert db.calls == 1                     # the second never reached the database

    db.release.set()
    assert (await first).status == "trained"


@pytest.mark.asyncio
async def test_the_guard_lifts_once_the_first_run_finishes():
    retrainer = Retrainer(db=_FakeDB(_rows(40)), collab=_FakeCollab())

    assert (await retrainer.run()).status == "trained"
    assert (await retrainer.run()).status == "trained"


def test_result_serialises_for_the_api_response():
    assert RetrainResult("trained", 40, 5, 5, 0.25).as_dict() == {
        "status": "trained",
        "interactions": 40,
        "users": 5,
        "movies": 5,
        "duration_seconds": 0.25,
        "detail": "",
    }
