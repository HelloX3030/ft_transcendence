# Recommendation Service — Development Progress

> Living document. Update it when a module is completed, a decision is made, or the plan changes.

---

## Current State

The full content-based pipeline and collaborative filtering are implemented and tested.
Profile weights accumulate on every positive signal via a lazy TMDB detail fetch.
SVD collaborative filtering loads from a checkpoint on startup and falls back to zeros
gracefully until a trained model exists. Remaining work: DB persistence and `retrain.py`.

```
recommendation/
├── __init__.py
├── requirements.txt       FastAPI, uvicorn, sklearn, numpy, scipy, httpx, joblib, pytest, pytest-asyncio
├── config.py              all hyperparameters in one frozen dataclass
├── schemas.py             Pydantic API contracts + MovieMetadata (Discover + detail fields)
├── engine.py              async orchestration + Protocol interfaces; detail-fetch guard
├── main.py                all endpoints wired; _CollabStub + _TMDBStub active (see Gaps)
├── content_based.py       genre cosine + TF-IDF overview + all four weight dicts — complete
├── engagement.py          delta accumulation + apply_signals — complete
├── diversifier.py         genre history + freshness boost — complete
├── tmdb_bridge.py         profile_to_params + fetch_candidates + fetch_movie_detail — complete
├── collaborative.py       SVD load/predict/train + atomic checkpoint — complete
├── retrain.py             not started
├── tests/
│   ├── test_tmdb_bridge.py       8 tests — profile_to_params
│   ├── test_fetch_candidates.py  9 tests — fetch_candidates (async)
│   ├── test_content_based.py    23 tests — content_score + update_profile (all weight dicts)
│   └── test_collaborative.py    12 tests — predict + train + checkpoint I/O
└── architecture.md        full algorithm spec (reference, do not edit here)
```

Run tests from `backend/app/`:
```
python3 -m pytest recommendation/tests -v
```

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Python deps | `requirements.txt` | Simple, Docker-friendly, no tooling overhead |
| Module interfaces | `Protocol` (structural typing) | Modules don't import from the engine; swap implementations freely |
| Hyperparameters | Frozen dataclass in `config.py` | Single source of truth, immutable at runtime |
| Cold-start alpha | Handled in `engine._effective_alpha()` | System-level concern belongs in the orchestrator, not a module |
| `UserProfile` type | Concrete dataclass in `content_based.py` | Engine Protocol only requires `user_id` + `interaction_count`; modules own the rest |
| Engagement deltas | Fields on `RecommenderConfig` | Consistent with all other hyperparameters; tunable without code changes |
| Diversification constants | Module-level in `diversifier.py` | Not in architecture spec — promote to `config.py` if tuning is needed |
| TMDB call location | **Option A: Python calls TMDB directly** | NestJS has no Discover integration; full pipeline in one service |
| Keyword/cast Discover params | OR-joined (`\|`), genres AND-joined (`,`) | AND-joining keywords/actors over-constrains Discover to near-empty pools |
| Page rotation hash | `zlib.crc32`, not `hash()` | `hash()` is salted per process — rotation would change on every restart |
| `keyword_weights` on `UserProfile` | Dict field, in-RAM only | Needed for `with_keywords` translation; populated via TMDB detail calls |
| Tests | pytest in `recommendation/tests/` | Pure-logic modules get unit tests |
| Movie metadata in engine cache | `_movie_cache: dict[int, MovieMetadata]` | `record_signal` enriches profile without an extra TMDB call per signal |
| Detail fetch trigger | Positive signals only; once per movie per process | Negative signals only need genre data; `_detail_fetched` guard prevents repeat calls |
| Detail cast limit | `_DETAIL_CAST_LIMIT = 5` in `tmdb_bridge.py` | Top 5 billed actors; not in architecture spec so kept as module constant |
| `record_signal` async | Made async alongside `fetch_movie_detail` | Detail fetch is I/O — must be awaited; `/signal` endpoint already async |
| Dislike only subtracts genre weights | Actor/keyword weights unchanged on negative signal | Penalising every actor from a disliked film would overfit on incidental associations |

---

## Open Decisions

| Decision | Status |
|---|---|
| DB schema additions | Request sent (`DB_REQUEST.md`). Blocking persistence and cold-start. |
| Docker integration | Pending infra team. Run command + env vars in Notes section below. |
| `user_id` type at API boundary | DB uses `Int`, Python uses `str`. Resolve at `main.py` boundary when DB is wired — low priority. |

---

## Module Checklist

| File | Status | Notes |
|---|---|---|
| `config.py` | Done | |
| `schemas.py` | Done | `MovieMetadata` carries Discover + detail fields (cast/director/keyword IDs) |
| `engine.py` | Done | Async; metadata cache; detail-fetch guard; `record_served` wired |
| `main.py` | Done | All endpoints wired; stubs active until real modules replace them |
| `content_based.py` | Done | Genre cosine + TF-IDF overview + all four weight dicts on `update_profile` |
| `engagement.py` | Done | |
| `diversifier.py` | Done | Freshness and genre history fully wired |
| `tmdb_bridge.py` | Done | `profile_to_params` + `fetch_candidates` + `fetch_movie_detail` |
| `collaborative.py` | Done | SVD load/predict/train; atomic checkpoint; zero fallback until first train |
| `retrain.py` | Not started | Nightly SVD batch job |

---

## Known Gaps & Temporary Solutions

Everything here is intentional and tracked — none of it is forgotten tech debt.

### Inline stubs in `main.py`

| Stub | Current behaviour | Replaced when |
|---|---|---|
| `_CollabStub` | Returns `np.zeros` for all candidates | Swap for `CollaborativeFilter()` in `main.py` — `collaborative.py` is ready |
| `_TMDBStub` | Runs real `profile_to_params`; `fetch_movie_detail` returns pool entry (cast fields empty) | `TMDB_API_KEY` in Docker — swap for `TMDBBridgeImpl()` in one line |

### `seen_ids` not deduplicated

`engine.get_feed` accepts `seen_ids` but `main.py` always passes `None`.
Users can be served films they have already interacted with.

**Blocked on:** DB integration — query `ratings` for the user's interaction history.

### No DB persistence

`ContentBasedFilter.load()` is a no-op. All profile state resets on service restart.

**Blocked on:** `user_profiles` and `user_preferences` tables in Prisma schema (`DB_REQUEST.md`).

### `/retrain` endpoint not secured

Accepts a `secret` query param but does not verify it and schedules nothing.

**Blocked on:** `collaborative.py` and `retrain.py`.

---

## Next Steps

**1. Wire `_CollabStub` → `CollaborativeFilter` in `main.py`**
One-line swap. `collaborative.py` is ready — just needs `model_dir` pointed at a
writable path and the stub replaced in the engine instantiation.

**2. DB integration**
Wire `ContentBasedFilter.load()`, persist profile vectors, fetch `seen_ids` on feed requests.
Depends on backend team applying schema additions from `DB_REQUEST.md`.

**3. `retrain.py`**
Nightly SVD retrain job. Depends on `collaborative.py` being stable.

---

## Notes for Other Teams

**Backend team (Prisma schema):** Three additions needed — see `DB_REQUEST.md` for full spec.
1. `ratings.watch_time Float?` — nullable; for skip_fast / watched_long signals
2. New table `user_profiles` — `userId`, `featureVector Float[]`, `updatedAt`
3. New table `user_preferences` — `userId`, `genreIds Int[]`, `actorIds Int[]`, `directorIds Int[]`

**Infra team (Docker):** Add a `recommender` service to `docker-compose.yml`:
- Build context: `./backend/app`
- Run command: `uvicorn recommendation.main:app --host 0.0.0.0 --port 8000`
- Env vars: `TMDB_API_KEY`, `DATABASE_URL`
- Network: same internal network as `backend` and `db`
- Once `TMDB_API_KEY` is available, swap `_TMDBStub` for `TMDBBridgeImpl()` in `main.py` (one line)
