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

_TMDB_DISCOVER_URL = "https://api.themoviedb.org/3/discover/movie"


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
# Part 2: TMDB Discover HTTP calls
# ---------------------------------------------------------------------------


async def _fetch_page(
    client: httpx.AsyncClient,
    params: dict,
    api_key: str,
    page: int,
) -> list[int]:
    """Fetch one Discover page. Returns the TMDB movie IDs on that page."""
    response = await client.get(
        _TMDB_DISCOVER_URL,
        params={**params, "page": page, "api_key": api_key},
        timeout=10.0,
    )
    response.raise_for_status()
    return [movie["id"] for movie in response.json().get("results", [])]


async def fetch_candidates(
    params: dict,
    exclude: list[int],
    min_pool: int = 20,
    *,
    config: RecommenderConfig = DEFAULT_CONFIG,
    api_key: str | None = None,
    _client: httpx.AsyncClient | None = None,
) -> list[int]:
    """
    Fetch candidate TMDB movie IDs from the Discover endpoint.

    Fetches config.tmdb_pages pages in parallel starting from params["page"].
    Filters out IDs in exclude. Keeps adding pages one at a time until the
    pool reaches min_pool or TMDB has no more results. A failed page is
    silently skipped so partial results are still returned.

    Args:
        params:    TMDB Discover query parameters (from profile_to_params).
        exclude:   IDs to drop — already-seen films, dislikes, etc.
        min_pool:  Target pool size before stopping the refill loop.
        config:    Hyperparameters (tmdb_pages, etc.).
        api_key:   TMDB API key; falls back to the TMDB_API_KEY env var.
        _client:   Injected httpx client (tests only — skips context-manager).

    Returns:
        Deduplicated list of TMDB movie IDs, ordered by discovery order.

    Raises:
        RuntimeError: If no API key is available at call time.
    """
    key = api_key or os.environ.get("TMDB_API_KEY", "")
    if not key:
        raise RuntimeError("TMDB_API_KEY is not configured")

    exclude_set = set(exclude)
    base_page = int(params.get("page", 1))

    async def _run(client: httpx.AsyncClient) -> list[int]:
        seen_in_pool: set[int] = set()
        pool: list[int] = []

        # Parallel initial burst.
        initial_pages = range(base_page, base_page + config.tmdb_pages)
        results = await asyncio.gather(
            *[_fetch_page(client, params, key, p) for p in initial_pages],
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, Exception):
                continue
            for mid in result:
                if mid not in exclude_set and mid not in seen_in_pool:
                    seen_in_pool.add(mid)
                    pool.append(mid)

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
            for mid in batch:
                if mid not in exclude_set and mid not in seen_in_pool:
                    seen_in_pool.add(mid)
                    pool.append(mid)
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
    ) -> list[int]:
        return await fetch_candidates(
            params, exclude, min_pool=min_pool, config=self._cfg, api_key=self._key
        )
