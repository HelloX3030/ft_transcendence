import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .collaborative import CollaborativeFilter
from .config import DEFAULT_CONFIG
from .content_based import ContentBasedFilter
from .db import Database
from .diversifier import Diversifier
from .engagement import EngagementTracker
from .engine import RecommenderEngine
from .schemas import EngagementSignal, FeedRequest, HealthResponse, MovieMetadata, ScoredMovie
from .tmdb_bridge import TMDBBridgeImpl, profile_to_params

# uvicorn only configures its own loggers — without this, the service's INFO
# lines (profile-load count, DB fallback warnings) never reach the console.
logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s — %(message)s")
logger = logging.getLogger(__name__)


class _SkipHealthChecks(logging.Filter):
    """
    Drop the access-log line for /health.

    The container health check polls it every ten seconds, which is a few hundred
    identical lines an hour — enough to push anything worth reading out of a
    scrollback. The other routes keep their access logs, since /feed and /signal
    are how you tell what the service is actually doing.

    uvicorn logs access records with args
    (client_addr, method, path, http_version, status), so the path is matched
    positionally rather than by searching the formatted line, which would also
    swallow a genuine request that happened to mention "/health".
    """

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        return not (isinstance(args, tuple) and len(args) >= 3 and args[2] == "/health")


logging.getLogger("uvicorn.access").addFilter(_SkipHealthChecks())

# ---------------------------------------------------------------------------
# Inline stubs — replaced module by module as real implementations land.
# ---------------------------------------------------------------------------


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

    async def fetch_movie_detail(self, movie_id: int) -> MovieMetadata:
        # Return the pool entry as-is — cast/keyword fields stay empty in the stub.
        pool_map = {m.tmdb_id: m for m in self._POOL}
        return pool_map.get(movie_id, MovieMetadata(tmdb_id=movie_id))


# ---------------------------------------------------------------------------
# Engine — single instance, created at startup.
# ---------------------------------------------------------------------------

_engine: RecommenderEngine | None = None
_content: ContentBasedFilter | None = None
_db: Database | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    global _engine, _content, _db

    _content = ContentBasedFilter()

    dsn = os.environ.get("DATABASE_URL", "")
    if dsn:
        db = Database(dsn)
        try:
            await db.connect()
            _db = db
            profiles = await db.load_all_profiles()
            _content.load_profiles(profiles)
            logger.info("loaded %d user profiles from DB", len(profiles))
        except Exception:
            logger.exception("DB unavailable — running in-RAM only, no persistence")
    else:
        logger.warning("DATABASE_URL not set — running in-RAM only, no persistence")

    # TMDB_API_KEY present → real Discover/detail calls; otherwise fixed stub pool.
    tmdb = TMDBBridgeImpl() if os.environ.get("TMDB_API_KEY") else _TMDBStub()

    _engine = RecommenderEngine(
        content_filter=_content,
        collab_filter=CollaborativeFilter(model_dir=os.environ.get("MODEL_DIR", "./models")),
        engagement_tracker=EngagementTracker(),
        diversifier=Diversifier(),
        tmdb_bridge=tmdb,
        config=DEFAULT_CONFIG,
    )
    yield

    if _db is not None:
        await _db.close()
        _db = None


app = FastAPI(title="CineMatch Recommender", version="0.1.0", lifespan=lifespan)


def _get_engine() -> RecommenderEngine:
    if _engine is None:
        raise HTTPException(status_code=503, detail="Engine not initialised")
    return _engine


async def _ensure_profile(user_id: str) -> None:
    """Users who registered after startup miss the bulk load — fetch their row
    (stored vector and/or onboarding prefs) on first contact."""
    if _db is None or _content is None or _content.has_profile(user_id):
        return
    try:
        profile = await _db.load_profile(user_id)
    except Exception:
        logger.exception("profile load failed for user %s", user_id)
        return
    if profile is not None:
        _content.load_profiles([profile])


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/feed", response_model=list[ScoredMovie])
async def get_feed(request: FeedRequest) -> list[ScoredMovie]:
    await _ensure_profile(request.user_id)

    seen_ids: list[int] | None = None
    if _db is not None:
        try:
            seen_ids = await _db.fetch_seen_tmdb_ids(request.user_id)
        except Exception:
            logger.exception("seen-ids query failed for user %s — feed served undeduplicated", request.user_id)

    return await _get_engine().get_feed(
        user_id=request.user_id, limit=request.limit, seen_ids=seen_ids
    )


@app.post("/signal", status_code=204)
async def record_signal(payload: EngagementSignal) -> None:
    await _ensure_profile(payload.user_id)
    await _get_engine().record_signal(
        user_id=payload.user_id,
        movie_id=payload.movie_id,
        action=payload.action,
        watch_time=payload.watch_time,
    )
    # Persist the updated profile — a DB blip must not fail the swipe itself.
    if _db is not None and _content is not None:
        try:
            await _db.save_profile(_content.get_profile(payload.user_id))
        except Exception:
            logger.exception("profile save failed for user %s", payload.user_id)


@app.post("/retrain", status_code=202)
async def trigger_retrain(secret: str) -> dict:
    # TODO: verify secret against env var, schedule SVD retrain job via retrain.py
    return {"status": "scheduled"}
