# Code Review — Watchlists module (backend)

Focused backend review of the **watchlists** module: CRUD, movies-in-lists,
shared users/roles, poster paths. Complements — does **not** duplicate —
`CODE_REVIEW_FINDINGS.md` (whose watchlist entries are frontend-only). All
findings here are new and backend-specific.

- **Files:** `backend/src/watchlists/watchlists.controller.ts`,
  `watchlists.service.ts`, `watchlists.module.ts`, `dto/*`;
  `prisma/schema.prisma` (`watchlists`, `watchlist_movies`, `watchlist_users`, `movies`);
  migrations `20260617072515_removed_owner_role`, `20260626134604_add_movie_poster_path`.
- **Reviewed:** 2026-07-23, against the working tree on `main`.

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · 🔧 Refactor · ⚙️ Process.
Line numbers are hints and will drift.

---

## ✅ Verification pass — 2026-07-23

Every finding re-checked against the working tree. **Key correction:** a global
`PrismaExceptionFilter` (`main.ts:23`) maps `P2003→409`, `P2002→409`, `P2025→404`,
`P2000→400`, and it composes with `HttpExceptionFilter` — proven by
`test/friends.e2e-spec.ts:112` (duplicate → **409**) and `:120` (missing → **404**),
both passing. So unhandled Prisma errors here surface as **409/404/400, NOT 500**.
This invalidates the "→ 500" framing in W2/W3/W4/W11/W15.

| ID | Verdict | Note |
|----|---------|------|
| W1 | ✅ Confirmed (Critical) | delete→cascade→`checkUserAccess` null→404; verified. Real bug. |
| W2 | ⚠️ Overstated | Not 500. Nonexistent user → **409** (P2003; should be 404). Duplicate → **409** (matches doc). Valid sub-point: dead `if (===null)` guard + generic message. Downgrade to Low. |
| W3 | ❌ False positive | Non-member → **404** via filter — already matches the documented 404. Only nit: generic "Record not found" message. Not a bug. |
| W4 | ❌ False positive | Same as W3 — → **404** as documented. |
| W5 | ✅ Confirmed | Governance gap (product decision). |
| W6 | ✅ Confirmed | Governance gap (product decision). |
| W7 | ✅ Confirmed | `original_title` stored. |
| W8 | ✅ Confirmed | Poster fetched once, raw fragment. |
| W9 | ✅ Confirmed | `user: true` over-select (not disclosed to client). |
| W10 | ✅ Confirmed | Dead null-guards (`create` throws, never returns null). |
| W11 | ⚠️ Overstated | Long name → P2000 → **400**, not 500; very low likelihood. |
| W12 | ✅ Confirmed | N+1 editor lookup. |
| W13 | ✅ Confirmed | Redundant access re-check in fan-out. |
| W14 | ✅ Confirmed | `titel` typo. |
| W15 | ⚠️ Overstated | Race is real; collision → **409** (P2002), not 500. `upsert` fix still valid. |
| W16 | ✅ Confirmed | Enum-narrowing migration breaks on legacy `owner` rows. |

Net: 1 Critical (W1) and the governance/refactor items stand. The High-severity
"three endpoints 500" cluster (W2/W3/W4) is wrong — those are already 409/404; only
message quality and the dead null-guards remain, at Low.

---

## 🔴 Critical

### W1 — Deleting a watchlist throws 404 after the delete and skips all notifications
`watchlists.service.ts:135-148` (`remove`)

`remove` deletes the watchlist first (line 137), *then* calls
`sendWatchlistNotify(id, currentUserId, msg)` (line 145). `watchlist_users` has
`onDelete: Cascade` (schema `watchlist_users:114`), so by the time
`sendWatchlistNotify` runs, every membership row — including the caller's — is
already gone. `sendWatchlistNotify` → `getUsers` → `checkUserAccess(id, currentUserId, false)`
does a `findUnique` on the now-deleted membership, gets `null`, and throws
`NotFoundException('Watchlists not found.')`. Net effect: the row **is** deleted,
but the HTTP response is a **404 error**, and the "watchlist deleted"
notification is **never delivered to anyone**. The success path is unreachable.

**Fix:** collect the member list *before* `watchlists.delete`, then notify after.
Don't route the post-delete notify through `getUsers`/`checkUserAccess` (which
require a live membership row).

---

## 🟠 High

### W2 — `addUser` turns FK / duplicate errors into 500s instead of 404/409
`watchlists.service.ts:250-269` (`addUser`)

The service does a bare `watchlist_users.create({ data: { watchlistId, userId: dto.userId, role } })`
with **no check that `dto.userId` refers to a real user** and **no duplicate
guard**. If the target user doesn't exist → Prisma `P2003` (FK violation) → 500.
If the user is already a member → `P2025`/`P2002` on the composite PK → 500. The
controller's Swagger advertises `409 User already added` and
`409 Watchlists not found or user not found`, but the service raises neither —
callers get an opaque `InternalServerErrorException`. The `if (watchlistUser === null)`
guard on line 260 is dead: `create` never resolves to `null`, it throws.

**Fix:** verify the user exists (or catch `P2003` → `NotFoundException`) and catch
`P2002` → `ConflictException('User already added.')`. Drop the dead null-check.

### W3 — `updateUserRole` 500s when the target user is not a member
`watchlists.service.ts:271-289` (`updateUserRole`)

After the self-check and caller `checkUserAccess`, it does
`watchlist_users.update({ where: { watchlistId_userId: { watchlistId: id, userId } } })`
without verifying the target is actually a member. A non-member (or wrong)
`userId` → Prisma `P2025` "record not found" → **500**, though the controller
documents `404`. No membership validation on the target at all.

**Fix:** guard with a `findUnique` (throw `NotFoundException`) before updating, or
catch `P2025` → `NotFoundException`.

### W4 — `removeUser` 500s when removing a non-member
`watchlists.service.ts:291-333` (`removeUser`)

Same shape as W3 on the delete path: the non-self branch only checks that the
*caller* is an editor (`checkUserAccess(id, currentUserId)`), never that the
*target* `userId` is a member. `watchlist_users.delete` on a missing composite
key → `P2025` → 500, not the documented `404`.

**Fix:** validate the target membership (or catch `P2025` → `NotFoundException`).

---

## 🟡 Medium

### W5 — Any editor can remove or demote any other editor (no self-protection beyond "last editor")
`watchlists.service.ts:271-333` (`updateUserRole`, `removeUser`)

With the `owner` role gone, all editors are symmetric. Editor A can remove
editor B, or demote B to viewer, with only a `checkUserAccess` (caller-is-editor)
guard. The only safety net is the "last editor cannot remove *themselves*" check
(line 292-303) — which only fires on **self**-removal. So two editors can evict
each other freely, and there is no guard against demoting the co-editor: with
editors {A, B}, A can demote B → viewer, leaving A as sole editor unilaterally.
This is a governance gap left by removing `owner`; confirm it's intentional that
membership is fully peer-to-peer with no creator/owner precedence.

**Fix (if unintended):** track the creator (or reintroduce a distinguished role),
or forbid an editor from removing/demoting another editor.

### W6 — Editors can rename/delete lists and add movies with no ownership concept
`watchlists.service.ts:110,135,167,200` + controller

`update`, `remove`, `addMovie`, `removeMovie` all gate on
`checkUserAccess(..., isEditor=true)`. Since the creator gets `editor` and any
editor can add further editors (W2/W5), *any* editor can rename or **delete** the
whole list, including lists they didn't create. Combined with W5, one editor can
delete a shared list out from under everyone. Worth an explicit product decision;
at minimum `remove` (destructive, cascades all movies + members) is a candidate
for a stricter guard than plain "editor".

**Fix:** decide whether delete/rename should be creator-only; document the model.

### W7 — `getMovieMeta` always stores `original_title`, never the localized/display title
`watchlists.service.ts:394-421`

Movie `name` is sourced from TMDB `original_title`. For non-English films this
stores e.g. the original-language title regardless of the app's language support
(`language_code` enum has `de/en/es`). There's no `language` query param on the
TMDB call. Users adding a foreign film see its original-language name in every
watchlist and notification.

**Fix:** request `?language=<code>` and prefer `title`, falling back to
`original_title`.

### W8 — Poster path is fetched once and never refreshed; TMDB path stored raw
`watchlists.service.ts:167-183,418-419`; `schema.prisma:29` (`posterPath String?`)

`posterPath` is captured only when a movie row is first created (first time *any*
watchlist adds that `tmdbId`) and cached forever in `movies`. If TMDB later
returns a poster for a film that had none at insert time (or changes it), the app
never updates. The stored value is the raw TMDB path segment (e.g. `/abc.jpg`);
the frontend prepends `https://image.tmdb.org/t/p/w185` itself
(`SimilarMovies.vue:23`), so the contract is "store the path fragment only" —
fine, but undocumented and easy to break. `poster_path` is correctly nullable
(migration + schema) and `extractPosterPaths` filters nulls (line 388-392); no
validation on the fragment shape.

**Fix:** document the "store TMDB path fragment, client builds the URL" contract;
consider a refresh path for null posters.

---

## 🔵 Low

### W9 — `checkUserAccess` over-selects and leaks the full user row
`watchlists.service.ts:335-358`

The `select` pulls `user: true` (the entire `users` row — password hash,
`totpSecret`, email, feature vectors, etc.) and `watchlist: {}`. Callers only use
`.role` and `.watchlist.name`. The full `user` object is fetched on every
mutating request purely as waste (it's never returned to the client here, so not
a disclosure — but it's needless load and a footgun if a caller ever returns the
object). `watchlist: {}` with an empty select is also a smell.

**Fix:** select only `{ role: true, watchlist: { select: { name: true } } }`.

### W10 — Dead / impossible null guards
`watchlists.service.ts:244` (`if (users === null && users === undefined)` — always
false), `:191`, `:260`, `:125` (`if (watchlistMovie === null)` / `create` never
returns null — Prisma throws on failure).

These branches can never execute; they give a false sense of error handling while
the real failure mode (Prisma exceptions) is unhandled (see W2–W4).

**Fix:** remove the dead guards; handle Prisma exceptions explicitly instead.

### W11 — `create`/`update` don't defend against a >255-char image URL slipping past
`dto/watchlist.dto.ts:13-18,28-33`; `schema.prisma:122` (`image String? @db.VarChar(255)`)

`image` is `@MaxLength(DEFAULT_MAX_LENGTH=255)` and `@IsUrl()`, matching the DB
`VarChar(255)` — good. But `name` is also capped at 255 in the DTO and DB, while
`getMovieMeta`-sourced movie `name` (`VarChar(255)`) is stored with **no length
guard** (line 179) — a TMDB title >255 chars → Prisma write error → 500 in
`addMovie`. Low likelihood, but unhandled.

**Fix:** truncate the TMDB `name` to 255 before insert (or widen the column).

---

## 🔧 Refactor

### W12 — N+1: editor list re-queried per watchlist in `findAll`
`watchlists.service.ts:57-71,360-386` (`findAll` → `toWatchlistDto` → per-list `findMany`)

`findAll` maps every membership through `toWatchlistDto`, which runs a separate
`watchlist_users.findMany({ role: 'editor' })` **per watchlist** to build
`editorIds`. A user in N lists triggers N extra queries (plus the cover include).
`findOne`/`create`/`update` inherit the same per-call query.

**Fix:** fold editors into the initial `WATCHLIST_SELECT`/`COVER_INCLUDE` include
(e.g. `watchlistUsers: { where: { role: 'editor' }, select: { userId: true } }`)
and derive `editorIds` from that in-memory.

### W13 — `sendWatchlistNotify` re-runs the full access check for a fan-out
`watchlists.service.ts:428-439`

It calls `getUsers(wlId, currentUserId)` — which itself re-runs
`checkUserAccess` (an extra `findUnique`) — solely to list recipients that were
often just loaded in the calling method. Redundant round-trips on every add/remove.

**Fix:** pass the already-loaded member list in, or query recipients directly
without the access re-check.

### W14 — Notification typo `titel` propagated into every watchlist notify
`watchlists.service.ts:264,327,434`

Uses the misspelled `titel` key (already flagged project-wide as R6 in
`CODE_REVIEW_FINDINGS.md`). Noting the watchlist call sites so the rename covers
them.

**Fix:** rename to `title` alongside the shared `NotifyMsg` fix.

### W15 — `addMovie` fetch → create is a race (duplicate movie rows / lost create)
`watchlists.service.ts:167-190`

`findUnique(tmdbId)` then conditional `create` is a check-then-act race: two
concurrent adds of a new `tmdbId` both see `null` and both `create` → one hits
the `tmdbId @unique` constraint → 500. Then the `watchlist_movies.create` can
also collide on its composite PK if the same movie is double-added → 500 (the
controller documents `409 Movie already added`, unimplemented).

**Fix:** `upsert` the movie on `tmdbId`; catch `P2002` on `watchlist_movies` →
`ConflictException('Movie already added.')`.

---

## ⚙️ Process

### W16 — `removed_owner_role` migration fails on any DB still holding `owner` rows
`prisma/migrations/20260617072515_removed_owner_role/migration.sql`

The enum-narrowing migration carries Prisma's own warning: the `USING` cast
`("role"::text::"watchlist_role_new")` throws if any `watchlist_users` row is
still `owner`. CI runs on an empty DB so it stays green; a developer/staging DB
with legacy `owner` rows breaks on migrate (same failure class as P1 in
`CODE_REVIEW_FINDINGS.md`).

**Fix:** add a pre-step `UPDATE watchlist_users SET role='editor' WHERE role='owner';`
before the enum swap.
