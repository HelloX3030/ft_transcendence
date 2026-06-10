# Recommendation Service — Development Progress

> Living document. Update it when a module is completed, a decision is made, or the plan changes.

---

## Current State

Core modules are in place. The engine can run a full request/response cycle end-to-end.
TMDB and collaborative filtering are stubbed out; real algorithm logic in `content_based.py` is pending TMDB data.

```
recommendation/
├── __init__.py          package marker
├── requirements.txt     dependencies (FastAPI, uvicorn, sklearn, numpy, scipy, httpx, joblib)
├── config.py            all hyperparameters + engagement signal deltas in one frozen dataclass
├── schemas.py           Pydantic API contracts (request/response models)
├── engine.py            orchestration + Protocol interfaces for all modules
├── main.py              FastAPI app — all endpoints wired; CF + TMDB are inline stubs
├── content_based.py     UserProfile dataclass + in-RAM profile cache; vector math is TODO
├── engagement.py        delta accumulation + apply_signals — fully implemented
├── diversifier.py       genre history + freshness boost — fully implemented
├── collaborative.py     not started
├── tmdb_bridge.py       not started
├── retrain.py           not started
└── architecture.md      full algorithm spec (reference, do not edit here)
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
| Diversification constants | Module-level in `diversifier.py` | Not in the architecture spec — promote to `config.py` if tuning is needed |
| TMDB call location | **Option A: Python calls TMDB directly** | NestJS has no Discover integration; keeping the full pipeline in one service is cleaner |

---

## Open Decisions

| Decision | Status |
|---|---|
| DB schema additions | Request sent to backend team (`DB_REQUEST.md`). Blocking DB persistence and cold-start. |
| Docker integration | Pending infra team. Requirements in `DB_REQUEST.md` notes and `PROGRESS.md` Notes section. |
| `user_id` type at API boundary | DB uses `Int`, Python uses `str`. Resolve at the `main.py` boundary when DB is wired — low priority. |

---

## Module Checklist

| File | Status | Notes |
|---|---|---|
| `config.py` | Done | |
| `schemas.py` | Done | |
| `engine.py` | Done | Pipeline fully wired; depends on real module implementations |
| `main.py` | Done | Endpoints wired to engine; CF + TMDB are inline stubs (see Gaps) |
| `content_based.py` | Partial | Profile dataclass + cache done; `content_score` + `update_profile` are stubs |
| `engagement.py` | Done | |
| `diversifier.py` | Done | `movie_ages` and `record_served` not yet wired (see Gaps) |
| `collaborative.py` | Not started | SVD matrix factorization + predict |
| `tmdb_bridge.py` | Not started | Profile → TMDB params + fetch_candidates (pending A/B decision) |
| `retrain.py` | Not started | Nightly SVD batch job |

---

## Known Gaps & Temporary Solutions

Everything here is intentional and tracked — none of it is forgotten tech debt.

### Inline stubs in `main.py`

| Stub | What it does | Replaces when |
|---|---|---|
| `_CollabStub` | Returns `np.zeros` for all candidates | `collaborative.py` is implemented |
| `_TMDBStub` | Returns a fixed list of 10 TMDB IDs; ignores profile params | `tmdb_bridge.py` is implemented |

### `content_based.py` — vector math not implemented

`content_score` returns `np.zeros`. `update_profile` increments the interaction count and timestamp only.
Neither the feature vector nor the genre/actor/director weight dicts are updated.

**Blocked on:** TMDB API integration — we need to fetch a movie's genres, cast, keywords, and overview before we can build or update the vector.

### Freshness boost inactive

`diversifier.apply()` accepts `movie_ages: dict[int, float] | None`. The engine calls it without this argument, so the `δ · freshness(f)` term is always zero.

**Blocked on:** `tmdb_bridge.py` — once candidates come with a `release_date`, the engine passes `movie_ages` down.

### Genre history for diversification never populated

`diversifier.record_served(user_id, genre_ids)` exists but the engine never calls it.
As a result, `should_diversify` always returns `False` — the diversification gamma boost never fires.

**Blocked on:** `tmdb_bridge.py` — candidate metadata (genre IDs) needed to call `record_served`.

### `seen_ids` not deduplicated

`engine.get_feed` accepts `seen_ids` but `main.py` always passes `None`.
Users will see already-watched films until the DB is wired.

**Blocked on:** DB integration — query `ratings` for the user's interaction history on each `/feed` request.

### No DB persistence

`ContentBasedFilter.load(db)` is a no-op. Profile vectors reset on every service restart.
Engagement deltas and genre history also live in RAM only.

**Blocked on:** `user_profiles` and `user_preferences` tables being added to the Prisma schema.

### `/retrain` endpoint not secured

The endpoint accepts a `secret` query param but does not verify it and does nothing.

**Blocked on:** `collaborative.py` and `retrain.py`.

---

## Next Steps

**1. `tmdb_bridge.py`** ← unblocked
TMDB call location decided (Option A). Translate the user profile vector into TMDB Discover
parameters (`profile_to_params`) and fetch + deduplicate candidates (`fetch_candidates`).
This unblocks real candidate pools, freshness boosts, and genre history for diversification.

**2. `content_based.py` — vector math**
Implement `content_score` and `update_profile` once TMDB data flows through `tmdb_bridge.py`.
Cosine similarity on feature vectors + TF-IDF on candidate overviews.

**3. `collaborative.py`**
SVD matrix factorization. Implement full structure (load/save checkpoint, `predict`) with a
graceful zero fallback until a trained model exists. Unblocks replacing `_CollabStub`.

**4. DB integration**
Wire `ContentBasedFilter.load()`, persist profile vectors, fetch `seen_ids` on feed requests.
Depends on backend team applying the schema additions from `DB_REQUEST.md`.

**5. `retrain.py`**
Nightly SVD retrain job. Last — depends on `collaborative.py` being stable.

---

## Notes for Other Teams

**Backend team (Prisma schema):** The algorithm needs three things not yet in the schema:

1. `ratings` table needs a `watch_time Float?` column (nullable; only set for `skip_fast` / `watched_long` signals)
2. New table `user_profiles` — `user_id Int @unique`, `feature_vector Bytes`, `updated_at DateTime`
3. New table `user_preferences` — `user_id Int @unique`, `genre_ids Int[]`, `actor_ids Int[]`, `director_ids Int[]`

**Infra team (Docker):** Add a `recommender` service to `docker-compose.yml`:
- Build context: `./backend/app`
- Run command: `uvicorn recommendation.main:app --host 0.0.0.0 --port 8000`
- Env vars needed: `TMDB_API_KEY`, `DATABASE_URL`
- Network: same internal network as `backend` and `db`
