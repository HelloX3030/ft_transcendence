# Code Review — TMDB + Redis cache

Focused second-opinion review of the **tmdb** module (discover / search / genres /
people / movie-detail / providers) and the **redis** cache layer that backs it.
The module was written by the reviewer; findings below are candid and specific.

- **Files:** `backend/src/tmdb/*` (controller, service, client, movie-filter,
  types, `dto/*`, specs) and `backend/src/redis/*` (service, module, constants).
- **Reviewed:** 2026-07-23, verified against the working tree on `main`.
- **Complements — does not duplicate — `CODE_REVIEW_FINDINGS.md`.** That doc's
  only tmdb item is **R2** (the dead *frontend* `tmdb.client.ts` that would ship
  a broken key). Everything below is new and backend-only. The backend correctly
  proxies TMDB and the key never reaches the client (see the "verified good"
  note at the end).

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · 🔧 Refactor · ⚙️ Process.
Line numbers are hints and will drift.

---

## ✅ Verification pass — 2026-07-23

All findings re-checked against the working tree — all confirmed present. No false
positives.

| ID | Verdict | Note |
|----|---------|------|
| T1 | ✅ Confirmed | `getPerson` catch swallows all `BadGatewayException`s (incl. outage). Good catch. |
| T2 | ✅ Confirmed | `Promise.all` over ≤50 ids, no stampede control. |
| T3 | ✅ Confirmed | Redis-down → all traffic to TMDB; warn per op. |
| T4 | ✅ Confirmed | `@MinLength(1)` on raw string; service trims to `""`. |
| T5 | ✅ Confirmed | Movie-detail cached with no `id`/`title` guard. |
| T6 | ✅ Confirmed | Empty result sets cached full TTL. |
| T7 | ✅ Confirmed | Providers cached with no shape check. |
| T8 | ✅ Confirmed | `2026-99-99` passes the regex. |
| T9 | ✅ Confirmed | Inverted `gte>lte` accepted. |
| T10 | ✅ Confirmed | `:filtered`/`:raw` suffix redundant for discover (params already differ). |
| T11 | ✅ Confirmed | `process.env.TMDB_API_KEY!` at call time. |
| T12 | ✅ Confirmed | `client.get(path)` implicit type param. |
| T13 | ✅ Confirmed | Ad-hoc, unversioned cache keys. |
| T14 | ✅ Confirmed | No `getPeople`/`getPerson`/`tmdb:person` cases in specs (grep). |
| T15 | ✅ Confirmed | Only `discover-query`/`pagination-query` DTO specs exist. |

---

## 🟠 High

### T1 — `getPeople` masks a total TMDB outage as an empty 200
`backend/src/tmdb/tmdb.service.ts:210-229` (`getPerson`) and `:204-208` (`getPeople`)

`getPerson`'s `catch` swallows **every** error from `client.get`, not just 404s.
The client only ever throws `BadGatewayException` — it does not distinguish a
per-id 404 (stale id, legitimately skip) from a 5xx / timeout / "TMDB
unreachable" (whole upstream down). So when TMDB is completely unavailable,
`getPeople` resolves `[...].map → all null → filter → []` and the endpoint
returns `200 OK { data: [] }`. The caller cannot tell "none of these people
exist" from "TMDB is down", and every id re-hits TMDB on the next call (nothing
cached). The doc-comment's intent ("unresolvable ids are skipped") is right, but
the implementation skips *all* failure classes.

**Fix:** in `TmdbClient.get`, throw a `NotFoundException` on `res.status === 404`
and keep `BadGatewayException` for the rest; in `getPerson`, catch only
`NotFoundException` (return `null`) and let `BadGatewayException` propagate so a
real outage surfaces as 502 instead of a silent empty list.

### T2 — Unbounded fan-out on a cold cache (people + no stampede control)
`backend/src/tmdb/tmdb.service.ts:206` — `Promise.all(uniqueIds.map(getPerson))`

`MAX_IDS = 50` (people-query.dto) caps a single request, but with a cold/flushed
cache one `/tmdb/people?ids=...` fires up to 50 concurrent TMDB requests, and N
simultaneous callers multiply that with no dedup. More broadly there is **no
cache-stampede protection anywhere** in the module: on a cache miss (or while
Redis is down — see T3) every concurrent request for the same key issues its own
upstream fetch. TMDB rate-limits (~50 req/10s per key); a burst of cold requests
can trip 429s that the client then surfaces as 502s to users.

**Fix:** bound person concurrency (e.g. a small `p-limit`/batched loop instead of
one big `Promise.all`). Optionally add per-key single-flight (an in-process
`Map<string, Promise<...>>` of in-flight fetches) so concurrent misses share one
upstream call.

---

## 🟡 Medium

### T3 — Redis-down degrades to "no cache", not "graceful" — every request hits TMDB
`backend/src/redis/redis.service.ts:15-30`, `redis.module.ts:15`

The service *does* degrade without 500s (get → null, set → no-op), which is the
right call and is verified. But the consequence is worth stating explicitly: with
Redis down, **100% of traffic proxies straight to TMDB** with no dedup (T2), so a
Redis outage converts directly into a TMDB rate-limit outage under any real load.
`disableOfflineQueue: true` makes each command fail fast (good), but the redis
client's default reconnect strategy also retries, and a warn is logged on every
single get/set failure — under load that is a log flood.

**Fix:** acceptable as-is for correctness, but consider (a) rate-limiting the
"Redis unavailable" warnings (log once per state transition, not per op), and
(b) a short in-process LRU fallback so a Redis blip doesn't fully expose TMDB.

### T4 — Whitespace-only search query normalizes to an empty TMDB request
`backend/src/tmdb/dto/search-query.dto.ts:7-10` + `tmdb.service.ts:113`

`@MinLength(1)` runs on the raw string, so `query="   "` (three spaces) passes
validation. The service then does `query.trim().toLowerCase()` → `""` and sends
`query=` to `/search/movie`, which TMDB rejects / returns garbage for, and caches
the empty-query result under key `tmdb:search::page:1:filtered`.

**Fix:** add `@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)`
before the length checks (trim in the DTO, matching where the service normalizes),
so a blank query is a 400 rather than a wasted upstream call.

### T5 — Movie-detail cache stores `null`-body / partial responses under a positive key
`backend/src/tmdb/tmdb.service.ts:146-182`

`getMovieDetail` reshapes whatever `client.get` returns; the "tolerate missing
sections" fix (defaulting `credits`/`videos`/`similar`) is good and tested. But
there is no validation that `response.id`/`title` actually exist — if TMDB ever
returns a 200 with a thin/partial body, a half-empty `TmdbMovieDetail` is cached
for an hour under `tmdb:movie:{id}` and served to every subsequent caller. Same
shape applies to `getWatchProviders` (T7).

**Fix:** guard on a required field (e.g. `if (!response?.id) throw new
BadGatewayException(...)`) before caching, so a malformed upstream body isn't
promoted to a cache entry.

### T6 — No negative-result guarding: empty/short-lived results cached for a full hour
`backend/src/tmdb/tmdb.service.ts:249` (`getCachedMovies`), `:138` (providers)

`getCachedMovies` caches *any* result — including an empty `results: []` from a
transient TMDB hiccup or a filter that stripped everything — for `CACHE_TTL_SECONDS`
(3600s). A one-off bad page pins an empty feed page for an hour. Providers (T7)
have the same issue: a movie with no providers yet caches an empty map for an hour.

**Fix:** either accept as intentional (document it) or use a shorter TTL for
empty result sets (e.g. cache `[]` for 60s so it self-heals).

### T7 — Watch-providers response is cached without any shape check
`backend/src/tmdb/tmdb.service.ts:128-140`

`response` is trusted to be `MovieWatchProviders` and cached as-is. TMDB returns
`{ id, results: {} }` for movies with no availability — fine — but there's no
`id` guard, so a partial/`null` body (see T5) would be cached and replayed.

**Fix:** same `if (!response?.id)` guard before `redis.set`.

---

## 🔵 Low

### T8 — Format-valid but calendar-invalid dates pass discover validation
`backend/src/tmdb/dto/discover-query.dto.ts:40,45`

`@Matches(/^\d{4}-\d{2}-\d{2}$/)` accepts `2026-99-99` / `0000-00-00`. TMDB
tolerates these (returns nothing), so it's cosmetic, but the bound silently
does nothing rather than 400-ing on an obviously bad date.

**Fix:** add `@IsDateString()` (or `@IsISO8601({ strict: true })`) alongside the
regex, or drop the regex for `@IsDateString()`.

### T9 — `releaseDateGte`/`Lte` ordering is never validated
`backend/src/tmdb/dto/discover-query.dto.ts:38-46`

`gte > lte` (inverted range) is accepted and forwarded; TMDB returns an empty
page which is then cached for an hour (T6). Minor, but an easy client mistake to
reject early.

**Fix:** optional cross-field check (`@ValidateIf` / a custom validator) rejecting
`releaseDateGte > releaseDateLte`.

### T10 — Redundant `filtered`/`raw` suffix in the discover cache key
`backend/src/tmdb/tmdb.service.ts:99`

When `filtered` is true the key already includes `vote_count.gte`/`vote_average.gte`
from `params.toString()`, so the trailing `:filtered`/`:raw` never
disambiguates two otherwise-identical keys — the params already differ. (For
search it *is* load-bearing, since the params are identical either way.) Harmless,
just dead specificity in one of the two callers.

**Fix:** none required; note it so the two call sites aren't assumed symmetric.

---

## 🔧 Refactor

### T11 — `TMDB_API_KEY!` non-null assertion instead of fail-fast
`backend/src/tmdb/tmdb.client.ts:14` — `Bearer ${process.env.TMDB_API_KEY!}`

Joi (`app.module.ts:34`) already makes the key required at boot, so the `!` is
safe in practice — but if that schema entry were ever removed, this would send
`Bearer undefined` and get a 401→502 with no clue why. Reading it once in the
constructor (or a small config accessor) localizes the contract.

**Fix:** read the key once at construction and assert presence there, or rely on a
typed `ConfigService` getter rather than a bare `process.env.X!` at call time.

### T12 — `getCachedMovies` calls `client.get` with no type parameter
`backend/src/tmdb/tmdb.service.ts:243`

`this.client.get(path)` defaults `T = TmdbListResponse`, so `response.results` /
`.page` / `.total_pages` are typed — but implicitly. An explicit
`client.get<TmdbListResponse>(path)` makes the contract obvious and survives a
future change to the client's default type param.

**Fix:** annotate the call `client.get<TmdbListResponse>(path)`.

### T13 — Cache-key building is ad-hoc and stringly-typed across the service
`backend/src/tmdb/tmdb.service.ts` (every method hand-builds `tmdb:...` keys)

Keys are assembled inline in six places with slightly different conventions
(`tmdb:discover:<params>:filtered`, `tmdb:search:<q>:page:<n>:filtered`,
`tmdb:movie:<id>`, `tmdb:providers:movie:<id>`, `tmdb:person:<id>`,
`tmdb:genres`). No shared namespace/version prefix, so a response-shape change
(e.g. reshaping `TmdbMovieDetail`) can't be invalidated except by waiting out the
TTL — old-shape JSON will be `JSON.parse`d into the new type and served.

**Fix:** centralize key construction (small `keys.ts` or a versioned prefix like
`tmdb:v1:...`) so a shape change can bump the version and orphan the old cache.

---

## ⚙️ Process — test-coverage gaps

Coverage is genuinely strong for discover/search/genres/detail/providers (cache
hit + miss, filtering, trailer selection, missing-sections tolerance, key/TTL
assertions, controller delegation, client 4xx/5xx/timeout paths, Redis
degradation). The gaps below are the untested surfaces:

### T14 — `getPeople`/`getPerson` have **zero** tests
`backend/src/tmdb/tmdb.service.spec.ts` (no `getPeople`/`getPerson`/`tmdb:person` cases)

The module's central resilience feature — "unresolvable ids are skipped rather
than failing the whole batch" (T1) — is completely untested: no coverage of the
skip-on-error path, `Set` de-duplication, per-id caching, or the partial-hit
merge. This is exactly the code T1 flags as behaving wrong, so a test here would
have caught it.

**Fix:** add cases: (a) mixed resolvable/unresolvable ids → only resolvable
returned; (b) duplicate ids deduped to one upstream call; (c) cache hit skips
`client.get`; (d) after T1's fix, a `BadGatewayException` propagates rather than
being swallowed.

### T15 — `people-query.dto` and `search-query.dto` have no spec
`backend/src/tmdb/dto/` (only `discover-query` and `pagination-query` have specs)

The people DTO's `@Transform` (comma-split, blank-drop, `Number` → `NaN`
rejection, array-vs-string input) and the `MAX_IDS`/`ArrayMinSize` bounds are
untested, as is the search DTO's length validation — including the T4
whitespace-only gap.

**Fix:** add `people-query.dto.spec.ts` (valid CSV, repeated-param array form,
`NaN` rejection, min/max size, empty→400) and `search-query.dto.spec.ts`
(min/max length, and the trim behaviour once T4 is fixed).

---

## Verified good (no action)

- **TMDB key never reaches the client.** All TMDB traffic goes through
  `TmdbClient` (backend); the controller returns only reshaped DTOs. The only
  key-leak risk is the *frontend* dead file already tracked as R2.
- **Endpoints are authenticated.** A global `JwtAccessGuard` (`app.module.ts:54`)
  covers `/tmdb/*`; no `@Public` on the controller, so these are not open.
- **Upstream error mapping is sound.** Network error / timeout / non-2xx all map
  to `BadGatewayException` with a warn log and no cache write (client.ts:23-31),
  and failures are *not* cached (verified by the "propagates … without caching"
  specs). The one exception is the over-broad `getPerson` catch (T1).
- **Redis degradation is real** (T3): get→null, set→no-op, no 500s.
- **Cache keys don't collide across endpoints/params** — each endpoint has a
  distinct prefix and folds its full param set into the key (the only redundancy
  is the cosmetic one in T10).
