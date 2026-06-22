# Recommendation Service — Development Progress

> Living document. Update it when a module is completed, a decision is made, or the plan changes.

---

## Current State

Content scoring and TMDB candidate fetching are both implemented and tested.
The service runs end-to-end with real scoring logic: genre cosine similarity + TF-IDF
on overviews blend into hybrid scores; engagement deltas shift rankings in real time.
The remaining gaps are actor/director/keyword weight population (needs a TMDB detail
call per film), collaborative filtering (SVD), and DB persistence.

```
recommendation/
├── __init__.py
├── requirements.txt       FastAPI, uvicorn, sklearn, numpy, scipy, httpx, joblib, pytest, pytest-asyncio
├── config.py              all hyperparameters in one frozen dataclass
├── schemas.py             Pydantic API contracts + MovieMetadata dataclass
├── engine.py              async orchestration + Protocol interfaces; movie metadata cache
├── main.py                all endpoints wired; _CollabStub + _TMDBStub active (see Gaps)
├── content_based.py       genre cosine similarity + TF-IDF overview scoring; update_profile done
├── engagement.py          delta accumulation + apply_signals — complete
├── diversifier.py         genre history + freshness boost — complete
├── tmdb_bridge.py         profile_to_params + async fetch_candidates + TMDBBridgeImpl — complete
├── collaborative.py       not started
├── retrain.py             not started
├── tests/
│   ├── test_tmdb_bridge.py       8 tests — profile_to_params
│   ├── test_fetch_candidates.py  9 tests — fetch_candidates
│   └── test_content_based.py    14 tests — content_score + update_profile
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
| `keyword_weights` on `UserProfile` | New dict field, in-RAM only | Needed for `with_keywords` translation; populated via TMDB detail calls |
| Tests | pytest in `recommendation/tests/` | Pure-logic modules get unit tests; first added for tmdb_bridge + content_based |
| Movie metadata in engine cache | `_movie_cache: dict[int, MovieMetadata]` | Lets `record_signal` enrich the profile without an extra TMDB call per signal |

---

## Open Decisions

| Decision | Status |
|---|---|
| DB schema additions | Request sent (`DB_REQUEST.md`). Blocking persistence and cold-start. |
| Docker integration | Pending infra team. Run command + env vars in `PROGRESS.md` Notes section. |
| `user_id` type at API boundary | DB uses `Int`, Python uses `str`. Resolve at `main.py` boundary when DB is wired — low priority. |

---

## Module Checklist

| File | Status | Notes |
|---|---|---|
| `config.py` | Done | |
| `schemas.py` | Done | `MovieMetadata` dataclass added; flows through full pipeline |
| `engine.py` | Done | Async; movie metadata cache; `record_served` wired for diversification |
| `main.py` | Done | All endpoints wired; stubs active until real modules replace them |
| `content_based.py` | Done | Genre cosine + TF-IDF overview; actor/keyword weights pending (see Gaps) |
| `engagement.py` | Done | |
| `diversifier.py` | Done | Freshness and genre history fully wired via engine |
| `tmdb_bridge.py` | Done | `profile_to_params` + `fetch_candidates` async + `TMDBBridgeImpl` |
| `collaborative.py` | Not started | SVD matrix factorization + predict |
| `retrain.py` | Not started | Nightly SVD batch job |

---

## Known Gaps & Temporary Solutions

Everything here is intentional and tracked — none of it is forgotten tech debt.

### Inline stubs in `main.py`

| Stub | Current behaviour | Replaced when |
|---|---|---|
| `_CollabStub` | Returns `np.zeros` for all candidates | `collaborative.py` is implemented |
| `_TMDBStub` | Runs real `profile_to_params` but returns 10 hardcoded movies | `TMDB_API_KEY` is in Docker; swap for `TMDBBridgeImpl()` in `main.py` |

### Actor / director / keyword weights not populated

`UserProfile` has `actor_weights`, `director_weights`, and `keyword_weights` dicts.
`profile_to_params` already reads them and builds `with_cast`, `with_crew`, `with_keywords`
Discover params — but `update_profile` never fills them in.

TMDB Discover results (`MovieMetadata`) only carry `genre_ids`. To get cast, crew, and
keywords we need a separate call to TMDB's `/movie/{id}?append_to_response=keywords,credits`.

**Next step:** add `fetch_movie_detail` to `tmdb_bridge.py` and call it from `record_signal`
in the engine when a positive action arrives. This makes `record_signal` async.

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

**1. Actor / director / keyword weights (`tmdb_bridge.py` + `content_based.py`)**
Add `fetch_movie_detail` to `tmdb_bridge.py` (TMDB `/movie/{id}?append_to_response=keywords,credits`).
Extend `MovieMetadata` or add a `MovieDetail` type with cast IDs, director IDs, keyword IDs.
Update `update_profile` to populate the three weight dicts on positive signals.
Makes `record_signal` in the engine async.

**2. `collaborative.py`**
SVD matrix factorization. Full structure (load/save checkpoint, `predict`) with zero
fallback until a trained model exists. Replaces `_CollabStub`.

**3. DB integration**
Wire `ContentBasedFilter.load()`, persist profile vectors, fetch `seen_ids` on feed requests.
Depends on backend team applying schema additions from `DB_REQUEST.md`.

**4. `retrain.py`**
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
