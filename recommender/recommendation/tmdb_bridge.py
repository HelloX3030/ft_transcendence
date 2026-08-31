"""
TMDB bridge: parameter translation (profile_to_params, pure) and candidate
fetching (fetch_candidates / TMDBBridgeImpl, async httpx over config.tmdb_pages
pages, deduped against seen ids, refilling the pool when it runs short).
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
    """TMDB_API_KEY holds a v4 read access token, sent as a Bearer header,
    same as the NestJS TmdbClient. The v3 api_key query param does not accept it."""
    return {"accept": "application/json", "Authorization": f"Bearer {token}"}


class TranslatableProfile(Protocol):
    """The slice of a user profile the translation reads. Structural, any
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
    cursor: int = 0,
) -> dict[str, str | int | float]:
    """
    Translate a user profile into the *core* TMDB Discover query.

    Genres are OR-joined and the vote floor sits a margin below the profile
    average, because this query is responsible for recall, not precision: it
    only has to return films worth ranking. Fine-grained taste matching happens
    in the re-ranking step, which scores every candidate against the full
    profile. AND-joining the dimensions here instead (the original spec in
    architecture.md 2.3) collapsed the pool to zero for engaged users, since a
    film then had to match every genre, an actor, a keyword and both vote
    floors at once (issue #247).

    Cast, crew and keywords are deliberately absent: they are issued as their
    own queries by profile_to_query_plan, so they widen the pool instead of
    narrowing it.

    Args:
        profile:   User taste profile (weights may be empty for new users).
        diversify: Drop the dominant genre from with_genres (anti-filter-bubble).
        config:    Hyperparameters (top-N counts, thresholds, page window).
        today:     Override for the page-rotation date (tests); defaults to date.today().
        cursor:    How many feeds deep the caller is; advances page and sort order.

    Returns:
        Discover params keyed by TMDB query-parameter name. Always contains
        sort_by, vote_count.gte and page; with_genres and vote_average.gte
        only when the profile carries a signal for them.
    """
    params: dict[str, str | int | float] = {
        "sort_by": _rotated_sort(cursor, config.tmdb_sort_cycle),
        "vote_count.gte": config.tmdb_min_vote_count,
        "page": _rotated_page(
            profile.user_id,
            today or date.today(),
            config.tmdb_page_window,
            cursor,
            config.tmdb_pages,
        ),
    }

    genres = _top_ids(profile.genre_weights, config.tmdb_top_genres + (1 if diversify else 0))
    if diversify and genres:
        # _top_ids is weight-sorted, so the dominant genre is first. Drop it and
        # let the extra slot fetched above refill back to the configured count.
        genres = genres[1:]
    if genres:
        # Pipe = OR. Comma (AND) demands a film carry all three genres at once,
        # which almost nothing does once the profile holds more than one.
        params["with_genres"] = "|".join(map(str, genres))

    if profile.avg_vote > 0:
        # A floor exactly at the average of everything the user liked rejects
        # half the films they would like. The margin keeps the floor useful
        # without making it the binding constraint.
        floor = max(0.0, profile.avg_vote - config.tmdb_vote_margin)
        params["vote_average.gte"] = round(floor, 1)

    return params


def profile_to_query_plan(
    profile: TranslatableProfile,
    *,
    diversify: bool = False,
    config: RecommenderConfig = DEFAULT_CONFIG,
    today: date | None = None,
    cursor: int = 0,
) -> list[dict[str, str | int | float]]:
    """
    Build the set of Discover queries whose union forms the candidate pool.

    One query per taste dimension rather than one query constrained by all of
    them. The core query (genres + vote floors) is always first and carries the
    bulk of the pool; each additional facet contributes films the core query
    would miss, and costs one page.

        core      genres OR-joined, vote floors        <- always present
        cast      films with a favourite actor         <- if actor weights qualify
        crew      films by a favourite director        <- if director weights qualify
        keywords  films matching favourite keywords    <- if keyword weights exist

    Facet queries carry no genre or vote-average constraint on purpose. "More
    films with this actor" is a complete intent by itself, and re-ranking drops
    the ones that do not fit the rest of the profile.

    Returns:
        Query list, core first. A profile with no cast/crew/keyword signal
        yields a single-element list, which is exactly the old behaviour.
    """
    core = profile_to_params(
        profile, diversify=diversify, config=config, today=today, cursor=cursor
    )
    plan = [core]

    base_page = int(core["page"])
    sort_by = core["sort_by"]

    def _facet(key: str, ids: list[int]) -> None:
        if not ids:
            return
        plan.append({
            "sort_by": sort_by,
            "vote_count.gte": config.tmdb_min_vote_count,
            "page": base_page,
            key: "|".join(map(str, ids)),
        })

    _facet("with_cast", _top_ids(profile.actor_weights, config.tmdb_top_cast, config.tmdb_min_person_weight))
    _facet("with_crew", _top_ids(profile.director_weights, config.tmdb_top_crew, config.tmdb_min_person_weight))
    _facet("with_keywords", _top_ids(profile.keyword_weights, config.tmdb_top_keywords))

    return plan


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


# TMDB refuses Discover pages beyond 500.
_TMDB_MAX_PAGE = 500


def _rotated_page(
    user_id: str,
    today: date,
    window: int,
    cursor: int = 0,
    stride: int = 1,
) -> int:
    """
    Where in the Discover results this request starts.

    Two independent movements. The per-user, per-day offset keeps two users
    with identical taste off the same films and reshuffles everyone daily;
    crc32 rather than hash(), which is salted per process and would re-roll the
    offset on every restart. The cursor then walks forward by a full fetch
    width per feed, so calling /feed repeatedly advances through the catalogue
    instead of re-serving one window (issue #249).
    """
    seed = f"{user_id}:{today.isoformat()}"
    base = crc32(seed.encode()) % window
    return min(base + cursor * max(stride, 1) + 1, _TMDB_MAX_PAGE)


def _rotated_sort(cursor: int, cycle: tuple[str, ...]) -> str:
    """Ordering for this request. Cycling it matters as much as paging: a user
    who exhausts the popular head of one ordering finds a different set of
    films at the head of the next, rather than page 40 of the same one."""
    return cycle[cursor % len(cycle)] if cycle else "popularity.desc"


async def fetch_movie_detail(
    movie_id: int,
    *,
    api_key: str | None = None,
    _client: httpx.AsyncClient | None = None,
) -> MovieMetadata:
    """
    Fetch full movie detail from TMDB, including top cast, director(s), and keywords.

    Calls /movie/{id}?append_to_response=keywords,credits, one HTTP request.
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
    plan: list[dict] | dict,
    exclude: list[int],
    min_pool: int = 20,
    *,
    config: RecommenderConfig = DEFAULT_CONFIG,
    api_key: str | None = None,
    _client: httpx.AsyncClient | None = None,
) -> list[MovieMetadata]:
    """
    Fetch candidate movies from the TMDB Discover endpoint.

    Takes a query plan (from profile_to_query_plan) and unions the results of
    every query in it. The first query is the core one and gets
    config.tmdb_pages pages; each facet after it gets config.tmdb_facet_pages.
    All of them are issued in parallel, so a plan of four queries costs roughly
    the same wall time as the single query this used to send.

    IDs in exclude are dropped, and duplicates across queries collapse to the
    first occurrence. If the pool is still short of min_pool, the core query
    keeps paging deeper until it fills or TMDB runs out. A failed page is
    skipped rather than fatal, so partial results still come back.

    Args:
        plan:      Query plan, core first. A bare dict is treated as a
                   single-query plan.
        exclude:   TMDB movie IDs to drop (already-seen films, dislikes).
        min_pool:  Target pool size before stopping the refill loop.
        config:    Hyperparameters (tmdb_pages, tmdb_facet_pages).
        api_key:   TMDB API key; falls back to the TMDB_API_KEY env var.
        _client:   Injected httpx client (tests only; skips the context manager).

    Returns:
        Deduplicated list of MovieMetadata, ordered by discovery order.

    Raises:
        RuntimeError: If no API key is available at call time.
    """
    key = api_key or os.environ.get("TMDB_API_KEY", "")
    if not key:
        raise RuntimeError("TMDB_API_KEY is not configured")

    queries = [plan] if isinstance(plan, dict) else list(plan)
    if not queries:
        return []

    exclude_set = set(exclude)
    core = queries[0]
    base_page = int(core.get("page", 1))

    async def _run(client: httpx.AsyncClient) -> list[MovieMetadata]:
        seen_in_pool: set[int] = set()
        pool: list[MovieMetadata] = []

        def _absorb(batch: list[MovieMetadata]) -> None:
            for movie in batch:
                if movie.tmdb_id not in exclude_set and movie.tmdb_id not in seen_in_pool:
                    seen_in_pool.add(movie.tmdb_id)
                    pool.append(movie)

        # Every query in the plan, every page of it, in one parallel burst.
        requests = []
        for index, query in enumerate(queries):
            pages = config.tmdb_pages if index == 0 else config.tmdb_facet_pages
            first = int(query.get("page", 1))
            requests += [
                _fetch_page(client, query, key, p) for p in range(first, first + pages)
            ]

        for result in await asyncio.gather(*requests, return_exceptions=True):
            if isinstance(result, Exception):
                continue
            _absorb(result)

        # Still short: page deeper on the core query only, one page at a time.
        # TMDB caps results at page 500.
        next_page = base_page + config.tmdb_pages
        while len(pool) < min_pool and next_page <= 500:
            try:
                batch = await _fetch_page(client, core, key, next_page)
            except httpx.HTTPError:
                break
            if not batch:
                break
            _absorb(batch)
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

    def profile_to_query_plan(
        self, profile: TranslatableProfile, diversify: bool = False, cursor: int = 0
    ) -> list[dict]:
        return profile_to_query_plan(
            profile, diversify=diversify, config=self._cfg, cursor=cursor
        )

    async def fetch_candidates(
        self, plan: list[dict], exclude: list[int], min_pool: int = 20
    ) -> list[MovieMetadata]:
        return await fetch_candidates(
            plan, exclude, min_pool=min_pool, config=self._cfg, api_key=self._key
        )

    async def fetch_movie_detail(self, movie_id: int) -> MovieMetadata:
        return await fetch_movie_detail(movie_id, api_key=self._key)
