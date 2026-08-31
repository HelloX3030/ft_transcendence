# Recommendation Service — Integration Guide

> How the NestJS backend talks to the Python recommendation microservice.
> Audience: backend + frontend teams. Algorithm internals live in `architecture.md`;
> implementation status in `PROGRESS.md`.
> Last updated: 2026-08-31 (branch `recommender-issues`; issues #247 and #249).

---

## 1. The service in one minute

A FastAPI microservice (Python) that answers one question — *"what should this user watch next?"* — and learns from one input — *"what did this user just do?"*.

```
                       POST /feed            GET (Discover / detail)
  frontend ──▶ NestJS ────────────▶ Recommender ─────────────▶ TMDB
                 │     ◀────────────    │
                 │   [{movie_id, score}] │  reads users, ratings, movies
                 │                       ▼  writes users.feature_vector
                 └──────────────▶ PostgreSQL
                  writes ratings,
                  movies, onboarding
```

- Runs on **port 8000** inside the Docker network (`uvicorn recommendation.main:app`).
- **NestJS is the only intended caller** — the frontend never talks to it directly.
- Stateless HTTP + shared PostgreSQL. Profiles live in RAM for speed and are
  persisted to `users.feature_vector` after every signal, so restarts lose nothing.

---

## 2. ID conventions — read this first

| Field | What it is | Why |
|---|---|---|
| `user_id` | `users.id` (the Prisma int), sent as a **string**: `"42"` | Service-internal keys are strings |
| `movie_id` | Always the **TMDB id** (`movies.tmdb_id`), never the internal `movies.id` | The whole pipeline is TMDB-native |

When NestJS persists a rating it maps TMDB id → internal `movies.id`; when calling
this service it must map back. We read `ratings JOIN movies` ourselves, so we always
see TMDB ids — nothing to convert on our side.

---

## 3. Endpoints

### 3.1 `POST /feed` — get a personalized feed

**Request**

```json
{ "user_id": "42", "limit": 10, "cursor": 0 }
```

| Field | Type | Constraints |
|---|---|---|
| `user_id` | string | required — `users.id` as string |
| `limit` | int | optional, default 10, min 1, max 50 |
| `cursor` | int | optional, default 0, min 0 — how many feeds deep into this browsing session the caller already is |

**About `cursor`.** Call `/feed` twice with the same `cursor` and you get the
same films: nothing else distinguishes the two calls. Raise it by one for each
further page inside one browsing session, and the candidate window moves
forward (and the Discover sort order rotates) so the user keeps seeing new
things. Reset it to `0` when a session starts.

You do not have to send it. The service also derives an advance from how much
the user has already rated, so a caller that always sends `0` still gets a feed
that moves as the user swipes — the cursor is what makes *repeated calls before
any of them produce a signal* return different films. `MoviesService.getFeed`
uses it to page rather than to widen its window.

**Response `200`** — sorted best-first, ready to serve in order:

```json
[
  { "movie_id": 27205, "score": 0.83 },
  { "movie_id": 603,   "score": 0.71 }
]
```

- `movie_id` is a **TMDB id**. The response carries no titles/posters/trailers —
  enrich through the existing NestJS TMDB proxy (`backend/src/tmdb/`).
- `score` is a **relative ranking value**, not a calibrated probability. Compare
  scores within one response only; don't display them or compare across users.

**Under the hood** (per request):

1. Load the user's taste profile (RAM, hydrated from `users.feature_vector` +
   onboarding prefs at startup).
2. Translate the profile into a **set** of TMDB Discover queries: a core query
   (top genres OR-joined + vote floors) plus one query each for favourite cast,
   crew and keywords. Page and sort order come from the cursor.
3. Fetch them all in parallel (~3 pages for the core query, 1 per facet) and
   **union** the results, refilling from the core query if the pool is short.
4. **Drop every movie the user has already rated** (from `ratings`) — the caller
   does not need to deduplicate. If that leaves nothing at all, retry once with
   every taste constraint dropped, so the feed is never empty for want of trying.
5. Re-rank the pool: content similarity (genre cosine + overview TF-IDF) blended
   with SVD collaborative filtering, plus engagement deltas, freshness and
   anti-filter-bubble boosts.
6. Return the top `limit`.

**Cold start** is automatic — no special calls needed:

| User state | Feed behavior |
|---|---|
| 0 interactions, no onboarding | TMDB popularity ranking |
| 0 interactions, onboarding done | Popularity filtered/ranked by onboarding genre/actor/director picks |
| 1–9 interactions | Content-based only |
| ≥ 10 interactions | Full hybrid (content + collaborative) |

### 3.2 `POST /signal` — report a user interaction

Call this **on every swipe/interaction event**, in addition to (not instead of)
writing the `ratings` row. Fire-and-forget: always answers `204`, never blocks
the user action (internal errors are logged, not returned).

**Request**

```json
{ "user_id": "42", "movie_id": 27205, "action": "like", "watch_time": 87.5 }
```

| Field | Type | Constraints |
|---|---|---|
| `user_id` | string | required |
| `movie_id` | int | required — TMDB id |
| `action` | string | required — one of the table below |
| `watch_time` | float | optional — seconds watched; send with `skip_fast` / `watched_long` |

**Actions** — ⚠️ the *caller* classifies watch-time behavior; we do not derive
actions from `watch_time`:

| `action` | Send when | Effect on ranking |
|---|---|---|
| `like` | User swipes right / likes the trailer | +0.20 |
| `dislike` | User swipes left / dislikes | −0.40 |
| `watchlist_add` | User adds the movie to a watchlist | +0.50 |
| `skip_fast` | Trailer watched **< 2 s** before skipping | −0.50 |
| `watched_long` | User watched **> 70 %** of the trailer | +0.30 |
| `rewatch` | Same trailer viewed again | +0.60 |
| `share` | Trailer shared | +0.60 |

**Response:** `204 No Content` (no body).

**Under the hood:** the profile updates immediately in RAM (genre weights; on
positive actions also cast/director/keywords via one TMDB detail call, cached per
movie), is persisted to `users.feature_vector`, and an engagement delta is
accumulated. The next `/feed` call already reflects the interaction.

### 3.3 `GET /health` — liveness

```json
{ "status": "ok" }
```

Use as the Docker healthcheck.

### 3.4 `POST /retrain?secret=...` — nightly SVD retrain (not functional yet)

Returns `202` but currently schedules nothing (`retrain.py` is the next work
item). Will be triggered by an internal cron, never by user traffic. Ignore for
integration purposes.

---

## 4. Who writes what in the database

| Data | Written by | Read by recommender for |
|---|---|---|
| `ratings` rows (`trailer_rating`, `watch_time`) | **NestJS** | Feed dedup, SVD training matrix |
| `movies` rows (tmdb_id mapping) | **NestJS** | Joining ratings to TMDB ids |
| `users.genre_ids` / `actor_ids` / `director_ids` | **NestJS** (onboarding) | Cold-start profile seed |
| `users.onboarding_completed` | **NestJS** | — (not read) |
| `users.feature_vector`, `users.feat_vec_updated_at` | **Recommender only** | Profile persistence |

Two rules keep us consistent:

1. **Keep writing `ratings` rows for likes/dislikes** — `/signal` does not write
   them. Ratings are our ground truth for dedup and collaborative filtering.
2. **Never write `users.feature_vector` from NestJS.** Treat it as our private
   column (it's a versioned binary-ish encoding; the format may change).

---

## 5. Onboarding — one open integration item

`POST /users/me/onboarding` currently stamps **mock** `genreIds`/`actorIds`/
`directorIds` (see TODO in `users.service.ts`). Two complementary fixes, both
supported today:

1. **Real preference arrays** — derive genre/actor/director ids from the picked
   movies (TMDB detail via your proxy) and store them instead of the mocks. We
   read these columns as the cold-start seed.
2. **Virtual likes (recommended, simplest)** — after onboarding completes, fire
   one `/signal` per picked movie: `{"user_id": "...", "movie_id": <tmdbId>, "action": "like"}`.
   That is exactly the "top-5 favorites become virtual likes" mechanism from the
   architecture spec (§1.5) — the profile learns genres *and* cast/directors/
   keywords from the picks automatically, and it gets persisted for us.

Doing (2) alone already gives new users a fully personalized first feed.

---

## 6. Deployment & configuration

```yaml
# docker-compose service (infra team)
recommender:
  build: ./backend/app
  command: uvicorn recommendation.main:app --host 0.0.0.0 --port 8000
  environment:
    DATABASE_URL: ${DATABASE_URL}   # same URL the backend uses (?schema=public is fine)
    TMDB_API_KEY: ${TMDB_API_KEY}   # v4 read access token — same var the backend uses
    # MODEL_DIR: /models            # optional; writable path for the SVD checkpoint
```

The service **degrades instead of crashing** when configuration is missing:

| Missing | Behavior |
|---|---|
| `DATABASE_URL` / DB down | In-RAM only: no persistence, no feed dedup, no cold-start seed (warning logged) |
| `TMDB_API_KEY` | Stub candidate pool of 10 fixed movies (dev mode) |
| SVD checkpoint (always, until first retrain) | Collaborative score is 0; content-based ranking still fully works |

Python deps: `backend/app/recommendation/requirements.txt`.
Tests: `cd backend/app && python3 -m pytest recommendation/tests` (64 tests, no DB needed).

---

## 7. Data we hold that could power future features

All of this exists per user in the profile — if a feature needs it, ask and we
expose a read endpoint (don't parse `feature_vector` yourselves):

- **Genre / actor / director / keyword taste weights** — could power a
  "your taste" profile page or "because you liked X" labels.
- **Average liked-movie rating** (`avg_vote`) — quality preference threshold.
- **Interaction count** — e.g. gate "improve my recommendations" prompts.
- **SVD latent factors** (after first retrain) — "users with your taste also liked".

Tunable hyperparameters (blend weights, signal deltas, thresholds) are all in
`config.py` — tell us what feels off in the feed and we tune there, no API change.
