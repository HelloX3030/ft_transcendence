import pytest
import httpx

from recommendation.config import RecommenderConfig
from recommendation.schemas import MovieMetadata
from recommendation.tmdb_bridge import fetch_candidates

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _movie(tmdb_id: int) -> dict:
    """Minimal TMDB Discover result dict for a given ID."""
    return {
        "id": tmdb_id,
        "genre_ids": [28, 12],
        "overview": f"Overview for movie {tmdb_id}",
        "release_date": "2023-01-01",
        "vote_average": 7.0,
    }


def _ids(movies: list[MovieMetadata]) -> set[int]:
    return {m.tmdb_id for m in movies}


class _FakeClient:
    """
    Minimal stand-in for httpx.AsyncClient.
    pages maps page number → list of TMDB movie IDs to return.
    fail_pages is the set of page numbers that should raise HTTPError.

    A real httpx.Request is attached to each Response so that
    raise_for_status() works correctly (it needs request to be set).
    """

    def __init__(self, pages: dict[int, list[int]], fail_pages: set[int] | None = None) -> None:
        self._pages = pages
        self._fail_pages = fail_pages or set()

    async def get(
        self,
        url: str,
        *,
        params: dict | None = None,
        headers: dict | None = None,
        timeout: float | None = None,
    ):
        page = int((params or {}).get("page", 1))
        if page in self._fail_pages:
            raise httpx.HTTPError(f"simulated failure on page {page}")
        ids = self._pages.get(page, [])
        req = httpx.Request("GET", url or "https://fake", params=params)
        return httpx.Response(
            200,
            json={"results": [_movie(mid) for mid in ids]},
            request=req,
        )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_returns_metadata_from_all_initial_pages():
    client = _FakeClient({1: [10, 20], 2: [30, 40], 3: [50, 60]})
    cfg = RecommenderConfig(tmdb_pages=3)
    movies = await fetch_candidates({}, exclude=[], min_pool=1, config=cfg, api_key="k", _client=client)
    assert _ids(movies) == {10, 20, 30, 40, 50, 60}


@pytest.mark.asyncio
async def test_metadata_fields_are_populated():
    client = _FakeClient({1: [42], 2: [], 3: []})
    cfg = RecommenderConfig(tmdb_pages=3)
    movies = await fetch_candidates({}, exclude=[], min_pool=1, config=cfg, api_key="k", _client=client)
    assert len(movies) == 1
    m = movies[0]
    assert m.tmdb_id == 42
    assert m.genre_ids == [28, 12]
    assert m.overview == "Overview for movie 42"
    assert m.release_date == "2023-01-01"
    assert m.vote_average == 7.0


@pytest.mark.asyncio
async def test_exclude_removes_ids():
    client = _FakeClient({1: [10, 20, 30], 2: [], 3: []})
    cfg = RecommenderConfig(tmdb_pages=3)
    movies = await fetch_candidates({}, exclude=[10, 30], min_pool=1, config=cfg, api_key="k", _client=client)
    assert _ids(movies) == {20}


@pytest.mark.asyncio
async def test_deduplicates_across_pages():
    # ID 20 on pages 1 and 2; ID 10 on pages 1 and 3 — each must appear once.
    client = _FakeClient({1: [10, 20], 2: [20, 30], 3: [10, 40]})
    cfg = RecommenderConfig(tmdb_pages=3)
    movies = await fetch_candidates({}, exclude=[], min_pool=1, config=cfg, api_key="k", _client=client)
    ids = [m.tmdb_id for m in movies]
    assert ids.count(20) == 1
    assert ids.count(10) == 1
    assert _ids(movies) == {10, 20, 30, 40}


@pytest.mark.asyncio
async def test_refills_when_pool_below_min():
    # Initial 3 pages yield only 3 usable movies; refill from page 4+.
    client = _FakeClient({
        1: [1, 100, 101],
        2: [2, 102],
        3: [103],
        4: [3, 4],
        5: [5, 6],
    })
    cfg = RecommenderConfig(tmdb_pages=3)
    movies = await fetch_candidates(
        {}, exclude=[100, 101, 102, 103], min_pool=5, config=cfg, api_key="k", _client=client
    )
    assert len(movies) >= 5
    assert {1, 2, 3, 4, 5}.issubset(_ids(movies))


@pytest.mark.asyncio
async def test_failed_page_in_initial_burst_is_skipped():
    # Page 2 fails — pages 1 and 3 still contribute.
    client = _FakeClient({1: [10, 20], 3: [50, 60]}, fail_pages={2})
    cfg = RecommenderConfig(tmdb_pages=3)
    movies = await fetch_candidates({}, exclude=[], min_pool=1, config=cfg, api_key="k", _client=client)
    assert _ids(movies) == {10, 20, 50, 60}


@pytest.mark.asyncio
async def test_refill_stops_on_http_error():
    # Pool stays below min_pool (3 < 5), refill page 4 raises — loop stops cleanly.
    client = _FakeClient({1: [1], 2: [2], 3: [3]}, fail_pages={4})
    cfg = RecommenderConfig(tmdb_pages=3)
    movies = await fetch_candidates({}, exclude=[], min_pool=5, config=cfg, api_key="k", _client=client)
    assert _ids(movies) == {1, 2, 3}


@pytest.mark.asyncio
async def test_refill_stops_on_empty_page():
    # TMDB runs dry — empty page stops the loop.
    client = _FakeClient({1: [1], 2: [2], 3: [], 4: []})
    cfg = RecommenderConfig(tmdb_pages=3)
    movies = await fetch_candidates({}, exclude=[], min_pool=5, config=cfg, api_key="k", _client=client)
    assert _ids(movies) == {1, 2}


@pytest.mark.asyncio
async def test_uses_base_page_from_params():
    # params["page"] = 3 → initial fetch should request pages 3, 4, 5.
    pages_requested: list[int] = []

    class _TrackingClient:
        async def get(
            self,
            url: str,
            *,
            params: dict | None = None,
            headers: dict | None = None,
            timeout: float | None = None,
        ):
            pages_requested.append(int((params or {}).get("page", 1)))
            req = httpx.Request("GET", url or "https://fake", params=params)
            return httpx.Response(200, json={"results": [_movie(999)]}, request=req)

    cfg = RecommenderConfig(tmdb_pages=3)
    await fetch_candidates(
        {"page": 3}, exclude=[], min_pool=1, config=cfg, api_key="k", _client=_TrackingClient()
    )
    assert set(pages_requested) == {3, 4, 5}


@pytest.mark.asyncio
async def test_missing_api_key_raises():
    with pytest.raises(RuntimeError, match="TMDB_API_KEY"):
        await fetch_candidates({}, exclude=[], api_key="", _client=_FakeClient({}))


# ---------------------------------------------------------------------------
# Query plans (issue #247): the pool is the union of every query in the plan
# ---------------------------------------------------------------------------


class _FacetClient:
    """
    Stand-in that answers per query rather than per page.

    routes maps a Discover parameter name ("with_genres", "with_cast", ...) to
    {page: [ids]}. A request is routed by whichever of those keys it carries,
    so a plan's core and facet queries can return different films.
    """

    def __init__(self, routes: dict[str, dict[int, list[int]]]) -> None:
        self._routes = routes
        self.seen_queries: list[tuple[str, int]] = []

    async def get(self, url: str, *, params=None, headers=None, timeout=None):
        params = params or {}
        key = next((k for k in self._routes if k in params), "")
        page = int(params.get("page", 1))
        self.seen_queries.append((key, page))
        ids = self._routes.get(key, {}).get(page, [])
        req = httpx.Request("GET", url or "https://fake", params=params)
        return httpx.Response(200, json={"results": [_movie(mid) for mid in ids]}, request=req)


@pytest.mark.asyncio
async def test_plan_unions_core_and_facet_results():
    cfg = RecommenderConfig(tmdb_pages=2, tmdb_facet_pages=1)
    plan = [
        {"with_genres": "28|12", "page": 1},
        {"with_cast": "6193", "page": 1},
        {"with_keywords": "4565", "page": 1},
    ]
    client = _FacetClient({
        "with_genres": {1: [1, 2], 2: [3, 4]},
        "with_cast": {1: [90, 91]},
        "with_keywords": {1: [70]},
    })

    pool = await fetch_candidates(
        plan, exclude=[], min_pool=0, config=cfg, api_key="k", _client=client
    )

    # Every query contributes; the core one contributes tmdb_pages worth.
    assert _ids(pool) == {1, 2, 3, 4, 90, 91, 70}


@pytest.mark.asyncio
async def test_plan_facets_get_facet_pages_not_core_pages():
    cfg = RecommenderConfig(tmdb_pages=3, tmdb_facet_pages=1)
    plan = [{"with_genres": "28", "page": 1}, {"with_cast": "6193", "page": 1}]
    client = _FacetClient({"with_genres": {}, "with_cast": {}})

    await fetch_candidates(plan, exclude=[], min_pool=0, config=cfg, api_key="k", _client=client)

    assert sorted(client.seen_queries) == [
        ("with_cast", 1),
        ("with_genres", 1),
        ("with_genres", 2),
        ("with_genres", 3),
    ]


@pytest.mark.asyncio
async def test_plan_deduplicates_films_shared_between_queries():
    cfg = RecommenderConfig(tmdb_pages=1, tmdb_facet_pages=1)
    plan = [{"with_genres": "28", "page": 1}, {"with_cast": "6193", "page": 1}]
    client = _FacetClient({
        "with_genres": {1: [1, 2, 3]},
        "with_cast": {1: [3, 4]},  # 3 appears in both
    })

    pool = await fetch_candidates(
        plan, exclude=[], min_pool=0, config=cfg, api_key="k", _client=client
    )

    assert [m.tmdb_id for m in pool] == [1, 2, 3, 4]


@pytest.mark.asyncio
async def test_plan_exclude_applies_across_every_query():
    cfg = RecommenderConfig(tmdb_pages=1, tmdb_facet_pages=1)
    plan = [{"with_genres": "28", "page": 1}, {"with_cast": "6193", "page": 1}]
    client = _FacetClient({
        "with_genres": {1: [1, 2]},
        "with_cast": {1: [90, 91]},
    })

    pool = await fetch_candidates(
        plan, exclude=[2, 90], min_pool=0, config=cfg, api_key="k", _client=client
    )

    assert _ids(pool) == {1, 91}


@pytest.mark.asyncio
async def test_bare_dict_is_still_accepted_as_a_single_query_plan():
    cfg = RecommenderConfig(tmdb_pages=1)
    client = _FakeClient({1: [1, 2, 3]})

    pool = await fetch_candidates(
        {"page": 1}, exclude=[], min_pool=0, config=cfg, api_key="k", _client=client
    )

    assert _ids(pool) == {1, 2, 3}


@pytest.mark.asyncio
async def test_empty_plan_returns_empty_pool():
    pool = await fetch_candidates([], exclude=[], api_key="k", _client=_FakeClient({}))

    assert pool == []
