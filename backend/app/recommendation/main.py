from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, HTTPException

from .config import DEFAULT_CONFIG
from .content_based import ContentBasedFilter
from .diversifier import Diversifier
from .engagement import EngagementTracker
from .engine import RecommenderEngine
from .schemas import EngagementSignal, FeedRequest, HealthResponse, MovieMetadata, ScoredMovie
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
    come from a fixed pool of 10 real TMDB movies — the params are computed and
    then ignored. Replaced by TMDBBridgeImpl once TMDB_API_KEY is wired in Docker.

    IDs: Dark Knight, Inception, Fight Club, Forrest Gump, The Avengers,
         Infinity War, Avatar, Interstellar, Star Wars IV, The Matrix.
    """

    _POOL: list[MovieMetadata] = [
        MovieMetadata(tmdb_id=155,    genre_ids=[18, 28, 80],        overview="Bruce Wayne becomes Batman to fight crime in Gotham."),
        MovieMetadata(tmdb_id=27205,  genre_ids=[28, 53, 878],       overview="A thief who steals corporate secrets through dream-sharing technology."),
        MovieMetadata(tmdb_id=550,    genre_ids=[18, 53],            overview="An insomniac office worker forms an underground fight club."),
        MovieMetadata(tmdb_id=13,     genre_ids=[18, 35, 10749],     overview="Forrest Gump witnesses and participates in defining historical events."),
        MovieMetadata(tmdb_id=24428,  genre_ids=[12, 28, 878],       overview="Earth's mightiest heroes assemble to stop an alien invasion."),
        MovieMetadata(tmdb_id=299536, genre_ids=[12, 28, 878],       overview="The Avengers face Thanos who seeks to collect all Infinity Stones."),
        MovieMetadata(tmdb_id=19995,  genre_ids=[12, 14, 28, 878],   overview="A paraplegic marine on an alien moon interacts with the native Na'vi."),
        MovieMetadata(tmdb_id=157336, genre_ids=[12, 18, 878],       overview="A team of explorers travel through a wormhole in space."),
        MovieMetadata(tmdb_id=11,     genre_ids=[12, 28, 878],       overview="Luke Skywalker joins rebels to rescue a princess and save the galaxy."),
        MovieMetadata(tmdb_id=603,    genre_ids=[28, 878],           overview="A computer hacker discovers the world is a simulation."),
    ]

    def profile_to_params(self, profile, diversify: bool) -> dict:  # type: ignore[override]
        return profile_to_params(profile, diversify=diversify)

    async def fetch_candidates(
        self, params: dict, exclude: list[int], min_pool: int = 20
    ) -> list[MovieMetadata]:
        exclude_set = set(exclude)
        return [m for m in self._POOL if m.tmdb_id not in exclude_set]


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
    return await _get_engine().get_feed(user_id=request.user_id, limit=request.limit)


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
