"""
Outbound TMDB pacing.

A direct port of the backend's `tmdb.budget.ts`, so both services shape their
traffic the same way and one reading of the numbers explains both. TMDB's own
limit is a soft, undocumented ~40 requests/second per IP, and the whole point is
to observe our own ceiling here rather than discover theirs as 429s.

The ceiling is per process. The NestJS client and this service each hold their
own budget, so what TMDB sees is the sum — size them together, not separately.
"""

import asyncio
import os
import time


class BudgetExhausted(Exception):
    """Raised when waiting for capacity would take longer than the caller can afford."""


class TMDBBudget:
    """
    GCRA, a leaky bucket expressed as a single timestamp.

    `_tat` is the moment the bucket would run dry. Callers arriving before
    `_tat - burst_tolerance` pass straight through, later ones wait their turn,
    and anything that would wait longer than `max_wait` is refused rather than
    queued — a request nobody is still waiting for is not worth sending.
    """

    def __init__(self, capacity: int, window_seconds: float, max_wait_seconds: float) -> None:
        self._emission_interval = window_seconds / capacity
        self._burst_tolerance = (capacity - 1) * self._emission_interval
        self._max_wait = max_wait_seconds
        self._tat = 0.0

    async def acquire(self) -> None:
        now = time.monotonic()
        arrival = max(self._tat, now)
        wait = arrival - self._burst_tolerance - now

        if wait > self._max_wait:
            raise BudgetExhausted(
                f"TMDB request budget exhausted; next slot is {wait:.2f}s away"
            )

        # Claim the slot before sleeping, so concurrent callers queue behind this
        # one instead of all racing for the same token. The fan-out in
        # tmdb_bridge issues its queries together, so this path is the common one.
        self._tat = arrival + self._emission_interval
        if wait > 0:
            await asyncio.sleep(wait)


class _Unlimited:
    """No pacing. What you get when TMDB_RATE_LIMIT is unset — tests and local
    runs stay deterministic instead of sleeping on a wall clock."""

    async def acquire(self) -> None:
        return None


# How long a caller will wait for capacity before being refused. Matches
# BUDGET_MAX_WAIT_MS in the backend's tmdb.client.ts.
MAX_WAIT_SECONDS = 2.0


def budget_from_env() -> TMDBBudget | _Unlimited:
    """
    Build the process-wide budget from TMDB_RATE_LIMIT and
    TMDB_RATE_WINDOW_SECONDS, the same variables the backend reads.

    Absent or non-positive means no pacing, which is what test runs and a bare
    local start get. docker-compose always sets them.
    """
    try:
        capacity = int(os.environ.get("TMDB_RATE_LIMIT", "0"))
        window = float(os.environ.get("TMDB_RATE_WINDOW_SECONDS", "1"))
    except ValueError:
        return _Unlimited()

    if capacity <= 0 or window <= 0:
        return _Unlimited()
    return TMDBBudget(capacity, window, MAX_WAIT_SECONDS)
