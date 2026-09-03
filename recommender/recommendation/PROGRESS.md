# Recommendation Service — Development Progress

> Living document. Update it when a module is completed, a decision is made, or the plan changes.

---

## Current State

The full pipeline is implemented, tested, and DB-backed. Profiles load from
`users.feature_vector` on startup (onboarding prefs seed cold-start users), persist
back after every signal, and feed requests deduplicate against the user's `ratings`
history. The real `CollaborativeFilter` is wired in `main.py`; `TMDBBridgeImpl`
activates automatically when `TMDB_API_KEY` is set. Docker integration landed on
main (`recommender/Dockerfile` + the `recommender` service in `docker-compose.yml`).

Issues #247 (over-constrained Discover query) and #249 (same films on every call)
are addressed: the candidate pool is now the union of one query per taste
dimension, and `/feed` takes a `cursor` that moves the window and rotates the
sort order. Both deviate from `architecture.md` as originally written — the
deviations are recorded in §2.3 and §2.4 there.

The module checklist is complete.

```
recommendation/
├── __init__.py
├── requirements.txt       FastAPI, uvicorn, sklearn, numpy, scipy, httpx, joblib, asyncpg, pytest, pytest-asyncio
├── config.py              all hyperparameters in one frozen dataclass
├── schemas.py             Pydantic API contracts + MovieMetadata (Discover + detail fields)
├── engine.py              async orchestration + Protocol interfaces; detail-fetch guard
├── main.py                all endpoints wired; DB + collab live; _TMDBStub only without TMDB_API_KEY
├── content_based.py       genre cosine + TF-IDF overview + all four weight dicts — complete
├── engagement.py          delta accumulation + apply_signals — complete
├── diversifier.py         genre history + freshness boost — complete
├── tmdb_bridge.py         profile_to_params + fetch_candidates + fetch_movie_detail — complete
├── collaborative.py       SVD load/predict/train + atomic checkpoint — complete
├── db.py                  asyncpg persistence: profile encode/decode, seen-ids, SVD rows — complete
├── retrain.py             nightly SVD refit + one-at-a-time guard — complete
├── tests/
│   ├── test_tmdb_bridge.py      18 tests — profile_to_params, query plan, cursor rotation
│   ├── test_fetch_candidates.py 16 tests — fetch_candidates + plan union (async)
│   ├── test_content_based.py    23 tests — content_score + update_profile (all weight dicts)
│   ├── test_collaborative.py    12 tests — predict + train + checkpoint I/O
│   ├── test_db.py               11 tests — vector round-trip, onboarding seed, DSN cleanup
│   ├── test_engine.py            9 tests — cursor derivation + empty-pool fallback
│   ├── test_retrain.py          12 tests — thresholds, failures, concurrency guard
│   └── test_retrain_endpoint.py 10 tests — the /retrain auth gate
└── architecture.md        full algorithm spec (reference, do not edit here)
```

Run tests from `recommender/`:
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
| `keyword_weights` on `UserProfile` | Dict field, persisted in `feature_vector` | Needed for `with_keywords` translation; populated via TMDB detail calls |
| Tests | pytest in `recommendation/tests/` | Pure-logic modules get unit tests |
| Movie metadata in engine cache | `_movie_cache: dict[int, MovieMetadata]` | `record_signal` enriches profile without an extra TMDB call per signal |
| Detail fetch trigger | Positive signals only; once per movie per process | Negative signals only need genre data; `_detail_fetched` guard prevents repeat calls |
| Detail cast limit | `_DETAIL_CAST_LIMIT = 5` in `tmdb_bridge.py` | Top 5 billed actors; not in architecture spec so kept as module constant |
| `record_signal` async | Made async alongside `fetch_movie_detail` | Detail fetch is I/O — must be awaited; `/signal` endpoint already async |
| Dislike only subtracts genre weights | Actor/keyword weights unchanged on negative signal | Penalising every actor from a disliked film would overfit on incidental associations |
| DB driver | `asyncpg` pool, raw SQL in `db.py` | Five queries total — an ORM adds nothing; Prisma's `?schema=public` is stripped from the DSN |
| `feature_vector` wire format | Sparse self-describing float array (header + id/weight pairs), versioned | Weight dicts have no fixed vocabulary, so a dense ~1500-dim layout is impossible; doubles hold TMDB ids exactly |
| Onboarding prefs merge | `setdefault` — learned weights always win over onboarding seeds | A disliked genre (negative weight) must not be reset to +1.0 by the onboarding pick |
| Profile persistence trigger | After every `/signal`, write-through; DB errors log but return 204 | A DB blip must not fail the swipe; RAM profile stays correct and is re-persisted on the next signal |
| Late-registered users | Lazy `_ensure_profile` per request in `main.py` | Startup bulk-load misses users created afterwards; one cheap existence check per request covers them |
| TMDB auth | `Authorization: Bearer` header, not `api_key` query param | `TMDB_API_KEY` in `.env` holds a v4 read access token (see NestJS `TmdbClient`) — v3 query auth rejects it |
| Discover query shape (#247) | **One query per taste dimension, unioned** — not one query constrained by all of them | AND-joining every dimension returns nothing for engaged users; Discover does recall, re-ranking does precision |
| Genre join (#247) | `\|` (OR), was `,` (AND) | Almost no film carries the user's top three genres at once |
| `vote_average.gte` (#247) | `avg_vote - tmdb_vote_margin`, was `avg_vote` | A floor on the average of liked films excludes half of them by construction |
| Feed pagination (#249) | `cursor` on `FeedRequest`, plus an advance derived from `len(seen_ids)` | The caller's cursor covers repeated calls before any signal lands; watch history covers everything after |
| Sort rotation (#249) | `tmdb_sort_cycle` cycled by cursor | Paging alone walks one ordering of the same popularity ranking |
| Empty pool (#249) | Retry once, unconstrained by taste | A blank screen is worse than an unpersonalised suggestion |
| Retrain trigger | `POST /retrain`, secret in an `X-Retrain-Secret` header | Query strings are logged verbatim by servers, proxies and browsers |
| Unset `RETRAIN_SECRET` | Refuse every request (503) | The opposite default is an open endpoint nobody notices |
| Too-thin training data | Skip, keep the old checkpoint | A model fitted on noise is worse than a stale one |
| Concurrent retrains | Plain flag, refuse the second immediately | A cron that double-fires must not stack two SVD fits |

---

## Open Decisions

| Decision | Status |
|---|---|
| DB schema additions | **Resolved** — landed on main (see `DB_REQUEST.md` header for the deviations). |
| `user_id` type at API boundary | **Resolved** — `db.py` converts str→int at the query boundary; non-numeric ids skip DB access gracefully. |
| Docker integration | Pending infra team. Run command + env vars in Notes section below. |

---

## Module Checklist

| File | Status | Notes |
|---|---|---|
| `config.py` | Done | |
| `schemas.py` | Done | `MovieMetadata` carries Discover + detail fields (cast/director/keyword IDs) |
| `engine.py` | Done | Async; metadata cache; detail-fetch guard; `record_served` wired |
| `main.py` | Done | DB + real collab wired; TMDB impl auto-selected via `TMDB_API_KEY` |
| `content_based.py` | Done | Genre cosine + TF-IDF overview + all four weight dicts on `update_profile` |
| `engagement.py` | Done | |
| `diversifier.py` | Done | Freshness and genre history fully wired |
| `tmdb_bridge.py` | Done | `profile_to_params` + `fetch_candidates` + `fetch_movie_detail`; v4 Bearer auth |
| `collaborative.py` | Done | SVD load/predict/train; atomic checkpoint; zero fallback until first train |
| `db.py` | Done | Profile load/save (+onboarding seed), seen-ids, SVD training rows |
| `retrain.py` | Done | Nightly SVD refit; skips rather than fits on too-thin data; one run at a time |

---

## Known Gaps & Temporary Solutions

Everything here is intentional and tracked — none of it is forgotten tech debt.

### `_TMDBStub` active without `TMDB_API_KEY`

`main.py` selects `TMDBBridgeImpl` automatically when `TMDB_API_KEY` is set;
otherwise the fixed 10-movie stub pool serves candidates. No code change needed
at deploy time — just the env var.

### `liked_overviews` not persisted

`users.feature_vector` is a float array, so the overview texts backing the
TF-IDF component can't be stored in it. After a restart the overview-similarity
term starts at zero and rebuilds as new positive signals arrive; genre/actor/
director/keyword weights, interaction count and avg_vote all survive the
round-trip. Acceptable: overview TF-IDF carries only `(1-β) = 0.3` of the
content score.

### No live DB in local test runs

`db.py`'s pure logic (encoding, onboarding merge, DSN cleanup) is unit-tested;
the asyncpg query paths were verified manually against a scratch PostgreSQL 16
with the real column definitions (load, save, seen-ids dedup, restart survival).
Without `DATABASE_URL` the service logs a warning and runs in-RAM only.

### Nothing schedules `/retrain` yet

The endpoint works and is authenticated, but no cron calls it, so the SVD
checkpoint is only refreshed when someone triggers it by hand. Until then
`predict()` returns zeros and the hybrid score is effectively content-only.
Wiring a nightly caller is the backend team's side (`INTEGRATION.md` §3.4).

---

## Next Steps

**1. Schedule the nightly retrain**
`/retrain` is implemented and authenticated; nothing calls it yet. Any cron that
can send `X-Retrain-Secret` will do.

**2. Onboarding virtual likes**
Fire one `/signal` per picked movie after onboarding. The preference arrays seed
genres/cast/directors; only real signals teach keywords and the overview TF-IDF.

**3. NestJS → recommender wiring**
Backend needs to call `POST /feed` and `POST /signal` (contract in `schemas.py`)
and map internal `movies.id` ↔ `tmdb_id` when it persists ratings.

---

## Notes for Other Teams

**Backend team (Prisma schema):** ~~Three additions needed~~ **Done on main** —
implemented on the `users` table rather than as separate tables (details in
`DB_REQUEST.md` header). No further schema work needed for now.

**Infra team (Docker):** Add a `recommender` service to `docker-compose.yml`:
- Build context: `./backend/app`
- Run command: `uvicorn recommendation.main:app --host 0.0.0.0 --port 8000`
- Env vars: `TMDB_API_KEY`, `DATABASE_URL`, optional `MODEL_DIR` (writable path for
  the SVD checkpoint, defaults to `./models`)
- Network: same internal network as `backend` and `db`
- No code changes needed — real TMDB and DB integrations activate when their env vars are present
