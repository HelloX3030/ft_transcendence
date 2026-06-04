# Recommendation Service — Development Progress

> Living document. Update it when a module is completed, a decision is made, or the plan changes.

---

## Current State

Foundation is in place. The service has the right shape but no algorithm logic yet.

```
recommendation/
├── __init__.py          package marker
├── requirements.txt     dependencies (FastAPI, uvicorn, sklearn, numpy, scipy, httpx, joblib)
├── config.py            all hyperparameters in one frozen dataclass
├── schemas.py           Pydantic API contracts (request/response models)
├── engine.py            orchestration + Protocol interfaces for all modules
├── main.py              FastAPI app — /health works, /feed + /signal + /retrain are stubs
└── architecture.md      full algorithm spec (reference, do not edit here)
```

The service is runnable. `/health` returns `{"status": "ok"}`. The other endpoints accept valid requests and return empty responses.

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Python deps | `requirements.txt` | Simple, Docker-friendly, no tooling overhead |
| Module interfaces | `Protocol` (structural typing) | Modules don't import from the engine; swap implementations freely |
| Hyperparameters | Frozen dataclass in `config.py` | Single source of truth, immutable at runtime |
| Cold-start alpha | Handled in `engine._effective_alpha()` | System-level concern belongs in the orchestrator, not a module |
| `UserProfile` type | Protocol with `user_id` + `interaction_count` | Engine never inspects the vector directly — modules own that detail |

---

## Open Decisions

| Decision | Options | Status |
|---|---|---|
| TMDB call location | **A**: Python calls TMDB directly · **B**: NestJS calls TMDB, passes candidates | Leaning A — discuss before implementing `tmdb_bridge.py` |
| DB schema | Needs `user_interactions`, `user_profiles`, `user_preferences` tables | Handled by backend team; communicate requirements when ready |
| Docker integration | Service needs its own entry in `docker-compose.yml` | Handled by infra team; communicate run command when ready |

---

## Module Checklist

| File | Status | Notes |
|---|---|---|
| `config.py` | Done | |
| `schemas.py` | Done | |
| `engine.py` | Done | Protocols defined, pipeline wired — needs real module implementations |
| `main.py` | Stubbed | Wire up engine once first modules are ready |
| `content_based.py` | Done (stub) | UserProfile dataclass + interface complete; vector math TODOs pending TMDB data |
| `collaborative.py` | Not started | SVD matrix factorization + predict |
| `engagement.py` | Done | Delta scores in config.py; in-RAM accumulation + apply |
| `diversifier.py` | Done | Genre history window + freshness boost; movie_ages wired later |
| `tmdb_bridge.py` | Not started | Profile → TMDB params + fetch_candidates (pending A/B decision) |
| `retrain.py` | Not started | Nightly SVD batch job |

---

## Next Steps

**1. `content_based.py`**
Most central module — provides the concrete `UserProfile` dataclass (not just the Protocol) and content scoring. Everything else depends on having a working profile representation.
Key pieces: feature vector as numpy array, weighted average with exponential time decay, cosine similarity against candidate feature vectors.

**2. Wire `main.py`**
Once the above three are in place, connect the engine to the FastAPI endpoints. The feed won't be personalized yet (no TMDB candidates, no CF), but the full request/response cycle will work end-to-end with real scoring logic.

**5. `collaborative.py`**
SVD-based CF. Heavier implementation — depends on having interaction data in the DB. Can be stubbed (returns zeros) until the DB schema is confirmed.

**6. `tmdb_bridge.py`**
Implement after the A/B decision is finalized. Profile → TMDB Discover params translation + candidate fetching.

**7. `retrain.py`**
Last — batch SVD retraining job. Depends on `collaborative.py` being stable.

---

## Notes for Other Teams

**Backend team (Prisma schema):** The algorithm needs these tables:
- `user_interactions` — `user_id`, `movie_id`, `action`, `watch_time`, `created_at`
- `user_profiles` — `user_id`, `feature_vector` (serialized float array), `updated_at`
- `user_preferences` — `user_id`, `genre_ids`, `actor_ids`, `director_ids` (onboarding data)

**Infra team (Docker):** The service will be a Python FastAPI app. Run command: `uvicorn recommendation.main:app --host 0.0.0.0 --port 8000` from `backend/app/`. Needs a `TMDB_API_KEY` secret and `DATABASE_URL` env var.
