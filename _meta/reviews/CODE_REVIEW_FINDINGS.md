# Code Review Findings

Manual review of everything merged after commit `b11eaff` (2026-06-29), covering
the 2FA/TOTP, WebSocket notify, chat, friends, watchlist-UI and API-refactor work.

- **Branch reviewed:** `findings` — includes PR #202 (ws-chat) and #203 (watchlist-user).
- **Reviewed:** 2026-07-23
- **Method:** every finding re-verified against the working tree on this branch;
  WebSocket and TOTP items were reproduced live against the running stack.

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · 🔧 Refactor · ⚙️ Process.
Line numbers reflect this branch and will drift as files change — treat them as hints.

> **Already fixed on this branch** (were open on `main`, closed by the #202/#203 merges):
> - Error events were broadcast to every socket → now `client.emit` (`notify.gateway.ts`).
> - Notification state survived logout → `stop()` now clears `count`/`notifyMsg`/`friendsStatus`/`chat`.

---

## 🔴 Critical

### C2 — Credentials logged to the browser console
`frontend/src/api/client.ts:43,48`

```js
console.log('frontend request:', path, options, 'response:', response.status, 'data:', json);
```

`options` is the raw `RequestInit`; `authApi.login`/`register` pass
`body: JSON.stringify({ email, password, otp })`. Email, password and TOTP code
are printed in cleartext on every auth request, on both success and error paths.
`vite.config.ts` configures no console-stripping, so this survives a production build.

**Fix:** remove both log lines (or gate behind a debug flag that never logs `options.body`).

---

## 🟠 High

### H1 — Online-status broadcast to every connected client
`backend/src/notify/notify.gateway.ts:60,75`

`this.server.emit(\`online-status:${id}\`, …)` targets the whole `notify`
namespace, bypassing the per-user `online-status:<id>` rooms that
`addClientToStatusUpdate` sets up. Any authenticated socket can observe presence
transitions for **every** user.

*Reproduced live:* a freshly-registered user received `online-status` events for
an unrelated stranger.

**Fix:** `this.server.to(\`online-status:${id}\`).emit(...)`.

### H3 — Closing one browser tab marks the user offline everywhere
`backend/src/notify/notify.gateway.ts:75` (`handleDisconnect`)

`NotifyService` correctly ref-counts sockets per user in a `Set`, but
`handleDisconnect` emits `isOnline: false` unconditionally after
`setUserAsInative`. With two tabs open, closing one broadcasts "offline" while
the user is still connected via the other.

*Reproduced live:* user with 2 sockets, closed 1 → observers received `isOnline: false`.

**Fix:** only emit offline when `this.notifyService.isOnline(userId)` is false after removal.

### H4 — Avatar upload is not awaited
`frontend/src/stores/user.ts:27`

```js
userApi.uploadAvatar(formData);   // missing await
await refetchUser();
```

`refetchUser()` races the upload, so the UI shows the stale avatar until a manual
refresh. Upload rejections escape the enclosing try/catch as unhandled promise
rejections, so `useUserEdit.update()` reports success even when the upload failed.

**Fix:** `await userApi.uploadAvatar(formData);`.

### H5 — TOTP verification has no clock-skew window
`backend/src/utils/otp.utils.ts:23` — `if (totp.generate() === otp)`

Compares only against the current 30-second step. A code read near a period
boundary (e.g. at second 27, submitted at second 31), or any client clock drift,
is rejected. Presents to users as intermittent "invalid code". Affects both login
(`auth.service.ts`) and activation (`users.service.ts`).

*Reproduced live:* previous- and next-window tokens both rejected;
`totp.validate({ token, window: 1 })` accepts them (delta −1 / +1).

**Fix:** `totp.validate({ token: otp, window: 1 })` (returns the delta, or `null`).

### H6 — Failed signup gives the user no feedback
`frontend/src/stores/auth.ts:59` — `catch (error) {}`

`register()` swallows every error. Chain on a taken email: backend `403` →
swallowed → `refetchUser()` 401 also swallowed (`useAsyncState` only rethrows
when `throwError` is set, which it is not) → `router.push('/')` → the router
guard bounces to `/login` because `/` is `requiresAuth`. Net effect: the user
submits signup, sees **no error at all**, and lands back on the login page.

**Fix:** re-throw from `register()` (as `login()` already does) so `SignupForm`
can set `errorMessage`.

---

## 🟡 Medium

### M1 — Every `err.status` branch is dead code
`frontend/src/api/client.ts` throws plain `new Error(message)` — no `status`
property and no custom error class. Consumers that branch on `err.status` never
take the intended path:
- `components/auth/SignupForm.vue` → always falls to "Could not reach the server."
- `composables/useLogin.ts` → "Invalid email or password." unreachable
- `composables/useUserEdit.ts`

**Fix:** throw a typed error from `client.ts` carrying `status` (and ideally the
parsed backend `message`).

### M2 — Friends online-status feature is unreachable from the UI
`frontend/src/stores/notify.ts` — `friendsStatus` is built and maintained
(`init`, `stop`, the watch handlers) but is **not** in the store's `return`
block, and no component reads it (confirmed: zero `.vue` consumers). The whole
backend presence round-trip (`watch-friends-status`, rooms, `isOnline`) runs and
produces nothing visible.

**Fix:** export `friendsStatus` and consume it (e.g. friend list / chat presence dots).

### M4 — Presence subscriptions are lost on reconnect
`frontend/src/stores/notify.ts` `init()` — `socket.emit('watch-friends-status')`
runs once, right after `socket.connect()`, not inside `socket.on('connect')`.
socket.io auto-reconnects with a **new** server-side socket (rooms gone), but the
client never re-subscribes. Presence silently dies after any network blip.
Currently masked by **M2**; becomes user-visible the moment `friendsStatus` is exposed.

**Fix:** emit `watch-friends-status` from inside the `socket.on('connect')` handler.

### M5 — Plaintext password held in memory across the MFA step
`frontend/src/composables/useLogin.ts:12,19,36` — `pendingCredentials` keeps
`{ email, password }` in a reactive ref between the password step and the OTP
step, then replays the full credential set. Reactive → visible in Vue devtools;
the password crosses the wire twice.

**Fix:** issue a short-lived MFA challenge token after password verification and
exchange that + OTP, instead of re-sending the password.

### M6 — No rate limiting anywhere
No `ThrottlerModule`, guard, or throttle reference in `backend/src` or
`backend/package.json`. `/auth/login` accepts unlimited attempts against both the
password and the 6-digit TOTP, and there is no replay/last-used-counter tracking,
so a captured code stays valid for its whole window.

**Fix:** add `@nestjs/throttler` (tight limit on `/auth/*`), and track the last
used TOTP counter to prevent replay.

### M7 — TOTP secrets encrypted with unauthenticated AES-256-CBC
`backend/src/utils/crypto.utils.ts` — CBC provides confidentiality but no
integrity; a tampered ciphertext is not detected.

**Fix:** use `aes-256-gcm` and store the auth tag alongside the IV.

### M10 — `/users/me` returns HTTP 200 with an empty body for a deleted user
`backend/src/users/users.service.ts:59` (`getMe`) does `findUnique` with no null
guard, and `auth/strategy/jwt.access.strategy.ts` does no DB lookup (it echoes
the JWT payload). A valid token for a since-deleted row returns `200` + empty body.

*Reproduced live:* register → delete the row → call with the still-valid cookie →
`HTTP 200`, empty body. Client-side that is `response.ok === true` then
`response.json()` on an empty body → `SyntaxError: Unexpected end of JSON input`,
surfaced as an opaque failure. Latent sibling: `'data' in json` in `client.ts`
throws `TypeError` if any endpoint ever returns a literal `null` body.

**Fix:** throw `NotFoundException`/`UnauthorizedException` when the user is gone;
guard the `in` check in `client.ts`.

---

## 🔵 Low

### L1 — Onboarding guard allows navigation while the user store is unready
`frontend/src/router/index.ts` — `if (requiresAuth && isLoggedIn && !isReady) return;`
returns undefined (= allow). Not reachable during normal startup (`main.ts` awaits
`auth.init()` + `refetchUser()` before mounting the router), only when
`refetchUser()` **fails**, leaving `isReady === false` while logged in. The app is
already degraded in that state, so impact is small.

**Fix:** on that branch, redirect to an error/login state instead of allowing through.

---

## 🔧 Refactor targets

### R1 — Two icon libraries installed and both in use
`frontend/package.json` has both `@lucide/vue` (^1.24.0) and `lucide-vue-next`
(^1.0.0); both are imported across the codebase. Duplicate icon sets in the bundle.
**Fix:** standardise on one, codemod the imports, drop the other.

### R2 — Dead TMDB client that would ship a broken key
`frontend/src/api/tmdb.client.ts` — `fetchJson` has **no importers** on this
branch. It reads `import.meta.env.VITE_TMDB_API_KEY`, which is defined nowhere
(`.env.example`, compose and `env.d.ts` all use unprefixed `TMDB_API_KEY`, which
Vite never exposes to client code), so it would send `Bearer undefined`.
Also `env.d.ts` falsely declares `TMDB_API_KEY` on `ImportMetaEnv`.
**Fix:** delete the file; drop `TMDB_API_KEY` from the frontend service in
`docker-compose.yml`, from `required` in `vite.config.ts`, and from `ImportMetaEnv`.
The backend proxies TMDB — the browser must never receive that key.

### R3 — Backend URL hardcoded
`frontend/src/api/client.ts` — literal `http://localhost:3000` (with its own
`//TODO: use env for url`). `VITE_BACKEND_URL` is validated in `vite.config.ts`
but only `stores/notify.ts` uses it. Nothing but localhost works.

### R4 — `try { … } catch (e) { throw e }` no-ops
`stores/user.ts` and `stores/auth.ts` — several catch blocks only rethrow. Remove them.

### R5 — Seed script inside app source
`frontend/src/lib/createUsersScript.js` — plain JS in a TS tree, inside shipped
source, with a hardcoded password. Superseded by `scripts/seed-friends.ts`. Delete it.

### R6 — Naming
- `notifyStore` → `useNotifyStore` (matches the `useXStore` convention used elsewhere)
- `titel` → `title` in the shared `NotifyMsg` type (propagates to both layers)
- `getFreinds` → `getFriends`, `setUserAsInative` → `setUserAsInactive`, `nofiyId` → `notifyId`
- `ChatRequiremtnsException` → `ChatRequirementsException` (class name is misspelled;
  the filename `chat-requirements-exception.ts` is correct). Exported/imported under the typo.

### R7 — Notify gateway / service details
- `notify.gateway.ts` — `server: Server = new Server()` builds a throwaway Server;
  `@WebSocketServer()` injects the real one, so the initializer is misleading.
- `addClientToStatusUpdate` emits a single-element array per friend, so
  `watch-friends-status` fires N times instead of once with N entries.
- `NotifyService.isOnline` — `.get(id) !== undefined` should be `.has(id)`.
- `getUserSockets` throws a bare `Error('User is offline.')` while the rest of the
  chat path uses `ChatRequiremtnsException` — inconsistent handling.
- Socket JWT is verified only at handshake; a long-lived socket outlives token expiry.

### R8 — Misc
- 22 `console.*` calls across `frontend/src` (dev noise in production).
- `useLogin.ts` — `onUnmounted(resetOtp); //TODO: do i need it really ??`.

---

## Chat (PR #202) — feature-specific notes

The chat handler (`notify.gateway.ts` `@SubscribeMessage('chat')`) adds good
hygiene: `@UsePipes(ValidationPipe { whitelist, forbidNonWhitelisted, transform })`
and a real authorization check (`hasChatRequirements` → `areFriends` + peer online)
before relaying. Points to confirm on review, not necessarily bugs:

- **No persistence.** Messages are relayed in-flight only, never stored — history
  is lost on refresh. And `hasChatRequirements` **rejects sending to an offline
  peer** outright. Confirm both are intentional scope decisions.
- **Error path echoes the undelivered message.** In the `catch`, the sender's own
  tabs get the `chat` echo *before* the system error, so other tabs render a
  message that was never delivered. Defensible as optimistic UI — confirm it's deliberate.

---

## ⚙️ Process

### P1 — `add_totp` migration cannot succeed on a populated database
`backend/prisma/migrations/20260622144913_add_totp/migration.sql` does
`ADD COLUMN totp_active BOOLEAN NOT NULL` with no default, which fails on any
non-empty `users` table (the file carries Prisma's own generated warning). CI
always runs against an empty DB, so it stays green and breaks only developer
machines that carry data — it took the backend down during this review (Prisma
P3009, backend exited 1 on startup).

**Fix:** amend to `... NOT NULL DEFAULT false` so the next developer isn't blocked.

---

## Verification scoreboard

| Verdict | Findings |
|---|---|
| Reproduced live | H1, H3, H5, M10, H6-precondition |
| Confirmed from code (this branch) | C2, H4, M1, M2, M4, M5, M6, M7, R1–R8, P1 |
| Fixed by #202/#203 merges | error-broadcast, logout-state-reset |
| Corrected vs. first pass | H6 (symptom was misdescribed), L1 (narrower than first thought) |
| Withdrawn | `requiresOnboarding` non-null assertion (unreachable — masked by M10) |
