from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Internal data types
# ---------------------------------------------------------------------------


@dataclass
class MovieMetadata:
    """
    Per-movie data that flows through the pipeline.

    Discover fields (always populated):
        tmdb_id, genre_ids, overview, release_date, vote_average

    Detail fields (populated by fetch_movie_detail on positive signal):
        cast_ids, director_ids, keyword_ids
    """

    tmdb_id: int
    genre_ids: list[int] = field(default_factory=list)
    overview: str = ""
    release_date: str | None = None
    vote_average: float = 0.0
    # Populated via /movie/{id}?append_to_response=keywords,credits
    cast_ids: list[int] = field(default_factory=list)
    director_ids: list[int] = field(default_factory=list)
    keyword_ids: list[int] = field(default_factory=list)


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
