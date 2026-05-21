from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# API request / response models
# ---------------------------------------------------------------------------


class FeedRequest(BaseModel):
    user_id: str
    limit: int = Field(default=10, ge=1, le=50)


class ScoredMovie(BaseModel):
    movie_id: int
    score: float


class EngagementSignal(BaseModel):
    user_id: str
    movie_id: int
    action: Literal[
        "like",
        "dislike",
        "watchlist_add",
        "skip_fast",
        "watched_long",
        "rewatch",
        "share",
    ]
    watch_time: float | None = None  # seconds; required for skip_fast / watched_long


class HealthResponse(BaseModel):
    status: str
