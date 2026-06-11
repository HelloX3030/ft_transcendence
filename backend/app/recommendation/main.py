from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, HTTPException

from .config import DEFAULT_CONFIG
from .content_based import ContentBasedFilter
from .diversifier import Diversifier
from .engagement import EngagementTracker
from .engine import RecommenderEngine
from .schemas import EngagementSignal, FeedRequest, HealthResponse, ScoredMovie
from .tmdb_bridge import profile_to_params

# ---------------------------------------------------------------------------
# Inline stubs — replaced module by module as real implementations land.
# ---------------------------------------------------------------------------


class _CollabStub:
    """Returns zeros for all candidates. Replaced by collaborative.py."""

    def predict(self, user_id: str, candidate_ids: list[int]) -> np.ndarray:
        return np.zeros(len(candidate_ids))


class _TMDBStub:
    """
    Real parameter translation (tmdb_bridge.profile_to_params), but candidates
    come from a fixed pool of 10 real TMDB IDs — the params are computed and
    then ignored. Replaced once fetch_candidates() (bridge part 2) lands.

    IDs: Dark Knight, Inception, Fight Club, Forrest Gump, The Avengers,
         Infinity War, Avatar, Interstellar, Star Wars IV, The Matrix.
    """

    _POOL: list[int] = [155, 27205, 550, 13, 24428, 299536, 19995, 157336, 11, 603]

    def profile_to_params(self, profile, diversify: bool) -> dict:  # type: ignore[override]
        return profile_to_params(profile, diversify=diversify)

    def fetch_candidates(self, params: dict, exclude: list[int]) -> list[int]:
        return [mid for mid in self._POOL if mid not in exclude]


# ---------------------------------------------------------------------------
# Engine — single instance, created at startup.
# ---------------------------------------------------------------------------

_engine: RecommenderEngine | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    global _engine
    _engine = RecommenderEngine(
        content_filter=ContentBasedFilter(),
        collab_filter=_CollabStub(),
        engagement_tracker=EngagementTracker(),
        diversifier=Diversifier(),
        tmdb_bridge=_TMDBStub(),
        config=DEFAULT_CONFIG,
    )
    yield


app = FastAPI(title="CineMatch Recommender", version="0.1.0", lifespan=lifespan)


def _get_engine() -> RecommenderEngine:
    if _engine is None:
        raise HTTPException(status_code=503, detail="Engine not initialised")
    return _engine


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/feed", response_model=list[ScoredMovie])
async def get_feed(request: FeedRequest) -> list[ScoredMovie]:
    # seen_ids: always None for now — wired to DB once user_interactions is queryable.
    return _get_engine().get_feed(user_id=request.user_id, limit=request.limit)


@app.post("/signal", status_code=204)
async def record_signal(payload: EngagementSignal) -> None:
    _get_engine().record_signal(
        user_id=payload.user_id,
        movie_id=payload.movie_id,
        action=payload.action,
        watch_time=payload.watch_time,
    )


@app.post("/retrain", status_code=202)
async def trigger_retrain(secret: str) -> dict:
    # TODO: verify secret against env var, schedule SVD retrain job via retrain.py
    return {"status": "scheduled"}
