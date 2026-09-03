import asyncio

import pytest

from recommendation.rate_limit import (
    BudgetExhausted,
    TMDBBudget,
    _Unlimited,
    budget_from_env,
)


@pytest.mark.asyncio
async def test_a_burst_up_to_capacity_passes_without_waiting():
    budget = TMDBBudget(capacity=20, window_seconds=1.0, max_wait_seconds=2.0)

    started = asyncio.get_running_loop().time()
    for _ in range(20):
        await budget.acquire()

    # The whole point of burst tolerance: a feed's fan-out goes out at once.
    assert asyncio.get_running_loop().time() - started < 0.05


@pytest.mark.asyncio
async def test_going_past_capacity_starts_pacing():
    budget = TMDBBudget(capacity=5, window_seconds=0.5, max_wait_seconds=2.0)

    for _ in range(5):
        await budget.acquire()

    started = asyncio.get_running_loop().time()
    await budget.acquire()
    waited = asyncio.get_running_loop().time() - started

    # One emission interval is window/capacity = 0.1s.
    assert waited >= 0.05


@pytest.mark.asyncio
async def test_a_wait_longer_than_the_ceiling_is_refused_not_queued():
    # Tiny capacity and a ceiling of nothing: the second call cannot be served.
    budget = TMDBBudget(capacity=1, window_seconds=10.0, max_wait_seconds=0.0)

    await budget.acquire()

    with pytest.raises(BudgetExhausted):
        await budget.acquire()


@pytest.mark.asyncio
async def test_concurrent_callers_queue_instead_of_racing_for_one_slot():
    budget = TMDBBudget(capacity=2, window_seconds=0.2, max_wait_seconds=5.0)
    order: list[int] = []

    async def caller(n: int) -> None:
        await budget.acquire()
        order.append(n)

    await asyncio.gather(*(caller(i) for i in range(6)))

    # Every caller was served exactly once; none was starved or double-counted.
    assert sorted(order) == list(range(6))


@pytest.mark.asyncio
async def test_an_idle_budget_does_not_accumulate_credit():
    budget = TMDBBudget(capacity=3, window_seconds=0.15, max_wait_seconds=2.0)

    for _ in range(3):
        await budget.acquire()
    await asyncio.sleep(0.2)  # bucket drains

    started = asyncio.get_running_loop().time()
    await budget.acquire()

    assert asyncio.get_running_loop().time() - started < 0.05


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


def test_no_env_means_no_pacing(monkeypatch):
    # Test runs and bare local starts must not sleep on a wall clock.
    monkeypatch.delenv("TMDB_RATE_LIMIT", raising=False)

    assert isinstance(budget_from_env(), _Unlimited)


def test_a_configured_limit_produces_a_real_budget(monkeypatch):
    monkeypatch.setenv("TMDB_RATE_LIMIT", "20")
    monkeypatch.setenv("TMDB_RATE_WINDOW_SECONDS", "1")

    assert isinstance(budget_from_env(), TMDBBudget)


@pytest.mark.parametrize("value", ["0", "-5", "not-a-number"])
def test_a_nonsense_limit_falls_back_to_no_pacing(monkeypatch, value):
    monkeypatch.setenv("TMDB_RATE_LIMIT", value)

    assert isinstance(budget_from_env(), _Unlimited)


@pytest.mark.asyncio
async def test_unlimited_never_blocks():
    started = asyncio.get_running_loop().time()
    for _ in range(500):
        await _Unlimited().acquire()

    assert asyncio.get_running_loop().time() - started < 0.05
