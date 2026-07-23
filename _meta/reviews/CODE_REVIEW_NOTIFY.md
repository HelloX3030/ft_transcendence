# Code Review — Notify / WebSocket / Chat / Presence

Focused backend pass over the `notify` module. Complements (does **not** duplicate)
`CODE_REVIEW_FINDINGS.md` — the H1/H3 presence bugs, R6/R7 naming + gateway details,
the `ChatRequiremtnsException` typo, `isOnline` vs `.has`, `getUserSockets` bare `Error`,
socket-JWT-expiry, and the PR#202 chat notes are already covered there and are **not**
repeated. Only new findings / new depth below.

Files reviewed:
- `backend/src/notify/notify.gateway.ts`
- `backend/src/notify/notify.service.ts`
- `backend/src/notify/notify.module.ts`
- `backend/src/notify/dto/notify.dto.ts`
- `backend/src/notify/exceptions/chat-requirements-exception.ts`
- `backend/src/types/notify.d.ts`
- `backend/src/utils/friend.utils.ts` (as consumed by notify)
- cross-checked callers in `backend/src/friends/friends.service.ts`

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · 🔧 Refactor · ⚙️ Process.
Line numbers are hints and will drift.

---

## ✅ Verification pass — 2026-07-23

All findings re-checked against the working tree.

| ID | Verdict | Note |
|----|---------|------|
| N1 | ✅ Confirmed | In-process Maps, no socket.io adapter. |
| N2 | ✅ Confirmed | No `implements OnGateway*`; hooks matched by name only. |
| N3 | ✅ Confirmed | No user-existence check on connect (ties to M10). |
| N4 | ✅ Confirmed | `getUserSockets` has zero callers (grep). Delete it. |
| N5 | ✅ Confirmed | `client.to` vs `server.to` split; error path re-emits body. |
| N6 | ✅ Confirmed | `Date.now()` recomputed per emit. |
| N7 | ✅ Confirmed | Seed broadcast to all tabs. |
| N8 | ❓ Low confidence | `DefaultEventsMap` used unimported. Compiles in CI (green), so it resolves somehow (likely via deprecated `@types/socket.io` globals) rather than being a hard error. Local `tsc` can't adjudicate — deps aren't synced locally. Cosmetic at most; import it or drop the generics. |
| N9 | ✅ Confirmed | Duplicated online-check predicate. |
| N10 | ✅ Confirmed | Throwaway `new Server()`. |
| N11 | ✅ Confirmed | Ad-hoc room strings. |

---

## 🟠 High

### N1 — Multi-instance / horizontal-scale safety: all presence + chat state is in-process memory
`notify.service.ts:12` (`userStatus = new Map<number, Set<Socket>>()`)

Presence (`userStatus`), the `user:<id>` / `online-status:<id>` rooms, and chat
relay all live in a single Node process with no socket.io adapter (no Redis/NATS).
Two backend replicas would each hold half the sockets: `isOnline(peer)` returns
`false` for a peer connected to the other instance, `hasChatRequirements` then
rejects the chat, and `sendNotify` (called from `friends`/`watchlists` services)
emits into a room the local `server` doesn't own, so cross-instance notifications
and chat silently vanish. `docker-compose.yml` runs one backend today, so this is
latent, but it blocks any scale-out and is worth recording before it's assumed safe.

**Fix:** if multi-instance is ever on the table, add `@socket.io/redis-adapter`
(or move presence to Redis) and route `sendNotify`/presence through it. Otherwise
document explicitly that the backend is single-instance-only.

### N2 — `handleConnection` / `handleDisconnect` don't implement the gateway lifecycle interfaces
`notify.gateway.ts:33,45,68`

`NotifyGateway` declares `handleConnection`/`handleDisconnect` but does **not**
`implements OnGatewayConnection, OnGatewayDisconnect` (and there's no
`OnGatewayInit`). Nest still calls them by name today, so it works — but there's
no compile-time guarantee the signatures stay correct, and a rename/typo
(`handleDisconect`) would silently stop cleaning up sockets, leaking presence
entries forever. Given the module relies entirely on these hooks for its in-memory
map hygiene, the lack of the interface contract is a real correctness risk.

**Fix:** `export class NotifyGateway implements OnGatewayConnection, OnGatewayDisconnect`.

---

## 🟡 Medium

### N3 — `setUserAsActive` never verifies the socket authenticated before adding it
`notify.gateway.ts:57-64`, `notify.service.ts:23`

In `handleConnection`, on a JWT-verify failure the catch runs `client.emit('error')`
+ `client.disconnect(true)`, but by then `setUserAsActive` has **not** been called
(it's after the `join`), so that path is fine. The real gap: `client.data.user`
and the `userStatus` insert happen *before* `this.server.emit(online-status…)`, and
there is no guard that `payload.sub` is a real, non-deleted user. A valid JWT for a
since-deleted account (see M10 in the main doc) is added to `userStatus` and
broadcast as online. Presence then advertises a ghost user, and `hasChatRequirements`
lets friends "chat" to it (messages relayed into an empty room).

**Fix:** after `verifyAsync`, confirm the user still exists (cheap `findUnique`
or reuse `UserUtils.getUser`) before `setUserAsActive` + the online broadcast.

### N4 — `getUserSockets` is dead code (and the only reason `ChatRequiremtnsException` inconsistency in R7 exists)
`notify.service.ts:62-66`

Grepping the whole backend, `getUserSockets` has **zero callers**. R7 in the main
doc flags its bare `throw new Error('User is offline.')` as "inconsistent" — but
the cleaner action is simply to delete the method. Chat authorization already goes
through `hasChatRequirements`; nothing needs the raw socket set.

**Fix:** remove `getUserSockets` entirely.

### N5 — Chat error path re-emits the failed message to other sender tabs, then a system error
`notify.gateway.ts:143-162`

The main doc's PR#202 note mentions "error path echoes the undelivered message."
Adding depth: on failure the handler emits the message via `client.to(user:me)`
(all of the sender's *other* sockets) **and** the SYSTEM error via
`this.server.to(user:me)` (all sockets incl. the sender). So on a 2-tab sender:
tab A (origin) sees only the system error and never its own message; tab B sees the
undelivered message *and* the system error. The two tabs render divergent, both-wrong
transcripts. The success path has the same asymmetry: peer relay uses `this.server.to`
(includes all peer tabs — good) but the sender echo uses `client.to(user:me)`, so the
originating tab never receives its own sent message and must optimistically render
locally. This split-brain between `client.to` and `server.to` is the root issue.

**Fix:** pick one consistent scheme — echo the sender's message with
`this.server.to(user:me)` (all tabs, origin included) on the success path, and on
failure emit **only** the system error (don't re-broadcast the undelivered body).

### N6 — `time: Date.now()` recomputed per-emit; peer and sender get different timestamps
`notify.gateway.ts:134,139` (and again 151,157 on the error path)

Each `emit` calls `Date.now()` independently, so the peer and the sender's own echo
carry slightly different `time` values for the same message. Harmless in practice but
means the same message can't be keyed/deduped by `(senderUserId, time)` across clients.

**Fix:** compute `const time = Date.now();` once at the top of `chat()` and reuse it.

---

## 🔵 Low

### N7 — `addClientToStatusUpdate` uses `client.data.user` for the room but takes `client` as arg
`notify.gateway.ts:97-103`

The method joins `client` to `online-status:<userId>` but then emits the seed status
to `user:<client.data.user>` via `this.server.to(...)` rather than to `client`
directly. Functionally equivalent for a single call, but it means every call
re-broadcasts to *all* of that user's tabs, not just the tab that subscribed — so a
second tab subscribing re-sends the seed array to the first tab too. Combined with the
R7 "one-element array per friend" issue, `watch-friends-status` is emitted N×(tabs)
times on connect.

**Fix:** emit the seed directly to the subscribing socket (`client.emit(...)`), and
batch all friends into a single array (see R7).

### N8 — `NotifySocket` type references undefined `DefaultEventsMap`
`backend/src/types/notify.d.ts:7`

`DefaultEventsMap` is used three times but never imported from `socket.io`. In a
`.d.ts` ambient context TS treats bare unresolved names loosely, so the build hasn't
complained, but the type is effectively `any`-typed for its event maps — the
`SocketData` generic still works, the event typing does not.

**Fix:** `import type { DefaultEventsMap } from 'socket.io';` (or drop the first
three generics and rely on defaults).

---

## 🔧 Refactor

### N9 — `isOnline` and `hasChatRequirements` duplicate the online check
`notify.service.ts:57-60,82`

`hasChatRequirements` inlines `this.userStatus.get(peerUserId) !== undefined`
instead of calling `this.isOnline(peerUserId)`. Two copies of the same presence
predicate (and R7 already wants `isOnline` rewritten to `.has`). Route both through
one `isOnline` that uses `this.userStatus.has(id)`.

### N10 — `server: Server = new Server()` + no `namespace`-scoped typing
`notify.gateway.ts:42-43`

R7 already flags the throwaway `new Server()`. Adding: the field is typed as the raw
`Server` rather than a `Namespace`, and `@WebSocketServer()` on a namespaced gateway
injects the **namespace**, so `this.server.emit` targets only the `notify` namespace
(correct) but the type invites confusion. Type it `private server: Namespace;`
(from `socket.io`) and drop the initializer.

### N11 — Presence room string built ad-hoc in 5 places
`notify.gateway.ts:58,60,75,100,101,…`

`user:${id}` and `online-status:${id}` template strings are hand-written throughout
both files. One typo (`user :${id}`) silently breaks delivery with no error.

**Fix:** extract `const userRoom = (id) => \`user:${id}\`` /
`onlineRoom(id)` helpers (or constants) and use them everywhere.
