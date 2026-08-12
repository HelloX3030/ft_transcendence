"""
TMDB bridge — parameter translation (part 1) and candidate fetching (part 2).

Part 1 (profile_to_params): pure logic, no I/O — fully unit-testable.
Part 2 (fetch_candidates / TMDBBridgeImpl): async httpx, config.tmdb_pages pages
  fetched in parallel, dedup against seen IDs, pool refill when too small.
"""

import asyncio
import os
from datetime import date
from typing import Protocol
from zlib import crc32

import httpx

from .config import DEFAULT_CONFIG, RecommenderConfig
from .schemas import MovieMetadata

_TMDB_DISCOVER_URL = "https://api.themoviedb.org/3/discover/movie"
_TMDB_MOVIE_URL = "https://api.themoviedb.org/3/movie"

# Top-N billed cast members included in cast_ids (billing order, 0 = lead).
_DETAIL_CAST_LIMIT = 5


def _auth_headers(token: str) -> dict[str, str]:
    """TMDB_API_KEY holds a v4 read access token — sent as a Bearer header,
    same as the NestJS TmdbClient. The v3 api_key query param does not accept it."""
    return {"accept": "application/json", "Authorization": f"Bearer {token}"}


class TranslatableProfile(Protocol):
    """The slice of a user profile the translation reads. Structural — any
    object with these fields works (concrete type: content_based.UserProfile)."""

    user_id: str
    interaction_count: int
    genre_weights: dict[int, float]
    actor_weights: dict[int, float]
    director_weights: dict[int, float]
    keyword_weights: dict[int, float]
    avg_vote: float


def profile_to_params(
    profile: TranslatableProfile,
    *,
    diversify: bool = False,
    config: RecommenderConfig = DEFAULT_CONFIG,
    today: date | None = None,
) -> dict[str, str | int | float]:
    """
    Translate a user profile into TMDB Discover query parameters.

    The translation is intentionally lossy — it approximates the
    high-dimensional profile; re-ranking on the returned pool compensates.
    Cold-start users (onboarding genres only, or nothing at all) flow through
    the same path: empty weight dicts simply omit their parameter.

    Args:
        profile:   User taste profile (weights may be empty for new users).
        diversify: Drop the dominant genre from with_genres (anti-filter-bubble).
        config:    Hyperparameters (top-N counts, thresholds, page window).
        today:     Override for the page-rotation date (tests); defaults to date.today().

    Returns:
        Discover params keyed by TMDB query-parameter name. Always contains
        sort_by, vote_count.gte and page; everything else only when the
        profile carries a signal for it.
    """
    params: dict[str, str | int | float] = {
        "sort_by": "popularity.desc",
        "vote_count.gte": config.tmdb_min_vote_count,
        "page": _rotated_page(profile.user_id, today or date.today(), config.tmdb_page_window),
    }

    genres = _top_ids(profile.genre_weights, config.tmdb_top_genres + (1 if diversify else 0))
    if diversify and genres:
        # _top_ids is weight-sorted, so the dominant genre is first. Drop it and
        # let the extra slot fetched above refill back to the configured count.
        genres = genres[1:]
    if genres:
        # Comma = AND in TMDB Discover (per spec: top genres AND-joined).
        params["with_genres"] = ",".join(map(str, genres))

    keywords = _top_ids(profile.keyword_weights, config.tmdb_top_keywords)
    if keywords:
        # Pipe = OR. AND-joining several keywords would over-constrain Discover
        # to a near-empty result set, unlike the broad genre dimensions.
        params["with_keywords"] = "|".join(map(str, keywords))

    cast = _top_ids(profile.actor_weights, config.tmdb_top_cast, config.tmdb_min_person_weight)
    if cast:
        params["with_cast"] = "|".join(map(str, cast))

    crew = _top_ids(profile.director_weights, config.tmdb_top_crew, config.tmdb_min_person_weight)
    if crew:
        params["with_crew"] = "|".join(map(str, crew))

    if profile.avg_vote > 0:
        params["vote_average.gte"] = round(profile.avg_vote, 1)

    return params


def _top_ids(weights: dict[int, float], n: int, min_weight: float = 0.0) -> list[int]:
    """Top-n TMDB IDs by weight, strongest first. Non-positive and
    below-threshold weights never qualify (disliked signals stay out)."""
    threshold = max(min_weight, 0.0)
    ranked = sorted(
        ((wid, w) for wid, w in weights.items() if w > threshold),
        key=lambda item: item[1],
        reverse=True,
    )
    return [wid for wid, _ in ranked[:n]]


def _rotated_page(user_id: str, today: date, window: int) -> int:
    """Daily page rotation: shifts the Discover result window per user per day
    so identical params don't serve the same 60 films forever. crc32 instead of
    hash() — the latter is salted per process and would break determinism."""
    seed = f"{user_id}:{today.isoformat()}"
    return crc32(seed.encode()) % window + 1


# ---------------------------------------------------------------------------
# Part 2: TMDB movie detail — cast, director, keywords
# ---------------------------------------------------------------------------


async def fetch_movie_detail(
    movie_id: int,
    *,
    api_key: str | None = None,
    _client: httpx.AsyncClient | None = None,
) -> MovieMetadata:
    """
    Fetch full movie detail from TMDB, including top cast, director(s), and keywords.

    Calls /movie/{id}?append_to_response=keywords,credits — one HTTP request.
    Returns a MovieMetadata with all fields populated (Discover fields included
    so the caller can replace the cached entry wholesale).

    Args:
        movie_id: TMDB movie ID.
        api_key:  TMDB API key; falls back to the TMDB_API_KEY env var.
        _client:  Injected httpx client (tests only).

    Raises:
        RuntimeError: If no API key is available.
    """
    key = api_key or os.environ.get("TMDB_API_KEY", "")
    if not key:
        raise RuntimeError("TMDB_API_KEY is not configured")

    async def _run(client: httpx.AsyncClient) -> MovieMetadata:
        response = await client.get(
            f"{_TMDB_MOVIE_URL}/{movie_id}",
            params={"append_to_response": "keywords,credits"},
            headers=_auth_headers(key),
            timeout=10.0,
        )
        response.raise_for_status()
        data = response.json()

        genre_ids = [g["id"] for g in data.get("genres", [])]
        keyword_ids = [k["id"] for k in data.get("keywords", {}).get("keywords", [])]

        credits = data.get("credits", {})
        cast_ids = [
            c["id"]
            for c in sorted(credits.get("cast", []), key=lambda c: c.get("order", 999))
            [:_DETAIL_CAST_LIMIT]
        ]
        director_ids = [
            c["id"]
            for c in credits.get("crew", [])
            if c.get("job") == "Director"
        ]

        return MovieMetadata(
            tmdb_id=movie_id,
            genre_ids=genre_ids,
            overview=data.get("overview", ""),
            release_date=data.get("release_date"),
            vote_average=float(data.get("vote_average", 0.0)),
            cast_ids=cast_ids,
            director_ids=director_ids,
            keyword_ids=keyword_ids,
        )

    if _client is not None:
        return await _run(_client)
    async with httpx.AsyncClient() as client:
        return await _run(client)


# ---------------------------------------------------------------------------
# Part 3: TMDB Discover HTTP calls
# ---------------------------------------------------------------------------


async def _fetch_page(
    client: httpx.AsyncClient,
    params: dict,
    api_key: str,
    page: int,
) -> list[MovieMetadata]:
    """Fetch one Discover page. Returns MovieMetadata for each result."""
    response = await client.get(
        _TMDB_DISCOVER_URL,
        params={**params, "page": page},
        headers=_auth_headers(api_key),
        timeout=10.0,
    )
    response.raise_for_status()
    return [
        MovieMetadata(
            tmdb_id=movie["id"],
            genre_ids=movie.get("genre_ids", []),
            overview=movie.get("overview", ""),
            release_date=movie.get("release_date"),
            vote_average=float(movie.get("vote_average", 0.0)),
        )
        for movie in response.json().get("results", [])
    ]


async def fetch_candidates(
    params: dict,
    exclude: list[int],
    min_pool: int = 20,
    *,
    config: RecommenderConfig = DEFAULT_CONFIG,
    api_key: str | None = None,
    _client: httpx.AsyncClient | None = None,
) -> list[MovieMetadata]:
    """
    Fetch candidate movies from the TMDB Discover endpoint.

    Fetches config.tmdb_pages pages in parallel starting from params["page"].
    Filters out IDs in exclude. Keeps adding pages one at a time until the
    pool reaches min_pool or TMDB has no more results. A failed page is
    silently skipped so partial results are still returned.

    Args:
        params:    TMDB Discover query parameters (from profile_to_params).
        exclude:   TMDB movie IDs to drop — already-seen films, dislikes, etc.
        min_pool:  Target pool size before stopping the refill loop.
        config:    Hyperparameters (tmdb_pages, etc.).
        api_key:   TMDB API key; falls back to the TMDB_API_KEY env var.
        _client:   Injected httpx client (tests only — skips context-manager).

    Returns:
        Deduplicated list of MovieMetadata, ordered by discovery order.

    Raises:
        RuntimeError: If no API key is available at call time.
    """
    key = api_key or os.environ.get("TMDB_API_KEY", "")
    if not key:
        raise RuntimeError("TMDB_API_KEY is not configured")

    exclude_set = set(exclude)
    base_page = int(params.get("page", 1))

    async def _run(client: httpx.AsyncClient) -> list[MovieMetadata]:
        seen_in_pool: set[int] = set()
        pool: list[MovieMetadata] = []

        # Parallel initial burst.
        initial_pages = range(base_page, base_page + config.tmdb_pages)
        results = await asyncio.gather(
            *[_fetch_page(client, params, key, p) for p in initial_pages],
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, Exception):
                continue
            for movie in result:
                if movie.tmdb_id not in exclude_set and movie.tmdb_id not in seen_in_pool:
                    seen_in_pool.add(movie.tmdb_id)
                    pool.append(movie)

        # Refill one page at a time until pool is large enough.
        # TMDB caps results at page 500.
        next_page = base_page + config.tmdb_pages
        while len(pool) < min_pool and next_page <= 500:
            try:
                batch = await _fetch_page(client, params, key, next_page)
            except httpx.HTTPError:
                break
            if not batch:
                break
            for movie in batch:
                if movie.tmdb_id not in exclude_set and movie.tmdb_id not in seen_in_pool:
                    seen_in_pool.add(movie.tmdb_id)
                    pool.append(movie)
            next_page += 1

        return pool

    if _client is not None:
        return await _run(_client)
    async with httpx.AsyncClient() as client:
        return await _run(client)


class TMDBBridgeImpl:
    """
    Concrete TMDB bridge for production use.
    Wraps the two public functions as instance methods to satisfy the engine Protocol.
    Inject into RecommenderEngine instead of _TMDBStub once TMDB_API_KEY is wired.
    """

    def __init__(
        self,
        api_key: str | None = None,
        config: RecommenderConfig = DEFAULT_CONFIG,
    ) -> None:
        self._key = api_key
        self._cfg = config

    def profile_to_params(self, profile: TranslatableProfile, diversify: bool = False) -> dict:
        return profile_to_params(profile, diversify=diversify, config=self._cfg)

    async def fetch_candidates(
        self, params: dict, exclude: list[int], min_pool: int = 20
    ) -> list[MovieMetadata]:
        return await fetch_candidates(
            params, exclude, min_pool=min_pool, config=self._cfg, api_key=self._key
        )

    async def fetch_movie_detail(self, movie_id: int) -> MovieMetadata:
        return await fetch_movie_detail(movie_id, api_key=self._key)
