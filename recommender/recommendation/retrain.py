"""
Nightly SVD retrain.

Both halves of the work already exist: db.fetch_interactions() produces the
rating matrix and CollaborativeFilter.train() fits it and atomically swaps the
checkpoint. This module is the orchestration around them — it decides whether a
retrain is worth running, keeps two from running at once, and reports what
happened so a failure is visible rather than silent.

Triggered by POST /retrain (see main.py). Scheduling the caller is the backend
team's side: any nightly cron that can send an authenticated HTTP request works.
"""

import logging
import time
from dataclasses import asdict, dataclass, field

logger = logging.getLogger(__name__)

# Floors below which a retrain would make the model worse, not better. svds
# needs k < min(n_users, n_movies), and a matrix this thin fits noise: the new
# checkpoint would replace a better one built from more data. Skipping leaves
# the existing checkpoint in place, which is the safer failure.
MIN_INTERACTIONS = 20
MIN_USERS = 3
MIN_MOVIES = 3


@dataclass(frozen=True)
class RetrainResult:
    """What one retrain attempt did. Serialised straight into the API response."""

    status: str  # "trained" | "skipped" | "failed"
    interactions: int = 0
    users: int = 0
    movies: int = 0
    duration_seconds: float = 0.0
    detail: str = ""

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class Retrainer:
    """
    Runs the retrain, one at a time.

    The guard is a plain flag rather than an asyncio.Lock because a second
    request should be told "already running" immediately, not queued behind the
    first — a nightly cron that fires twice must not stack two full SVD fits.
    Checking and setting it without an await in between is atomic under asyncio.
    """

    db: object
    collab: object
    _running: bool = field(default=False, init=False)
    last_result: RetrainResult | None = field(default=None, init=False)

    @property
    def running(self) -> bool:
        return self._running

    async def run(self) -> RetrainResult:
        if self._running:
            return RetrainResult("skipped", detail="a retrain is already running")
        self._running = True
        try:
            result = await self._run()
        finally:
            self._running = False
        self.last_result = result
        return result

    async def _run(self) -> RetrainResult:
        started = time.monotonic()

        def elapsed() -> float:
            return round(time.monotonic() - started, 3)

        try:
            interactions = await self.db.fetch_interactions()
        except Exception as exc:
            logger.exception("retrain: could not read interactions")
            return RetrainResult("failed", duration_seconds=elapsed(), detail=str(exc))

        users = len({row[0] for row in interactions})
        movies = len({row[1] for row in interactions})
        counts = dict(interactions=len(interactions), users=users, movies=movies)

        too_thin = (
            len(interactions) < MIN_INTERACTIONS or users < MIN_USERS or movies < MIN_MOVIES
        )
        if too_thin:
            logger.info(
                "retrain skipped: %d interactions, %d users, %d movies "
                "(need %d/%d/%d) — keeping the existing checkpoint",
                len(interactions), users, movies, MIN_INTERACTIONS, MIN_USERS, MIN_MOVIES,
            )
            return RetrainResult(
                "skipped",
                **counts,
                duration_seconds=elapsed(),
                detail="not enough data to fit a model worth keeping",
            )

        try:
            # Synchronous and CPU-bound. It runs in a background task, so the
            # event loop is blocked for its duration; at this data size that is
            # well under a second. Move it to a thread if the matrix grows.
            self.collab.train(interactions)
        except Exception as exc:
            logger.exception("retrain: SVD fit failed")
            return RetrainResult(
                "failed", **counts, duration_seconds=elapsed(), detail=str(exc)
            )

        logger.info(
            "retrain complete: %d interactions, %d users, %d movies in %.3fs",
            len(interactions), users, movies, elapsed(),
        )
        return RetrainResult("trained", **counts, duration_seconds=elapsed())
