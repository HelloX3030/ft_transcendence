# Code Review — Friends Module

Focused backend review of the friends module: friend requests, accept, delete,
initiator tracking, canonical user ordering, and the presence hooks into notify.

- **Reviewed:** 2026-07-23 — verified against the working tree on `main`.
- **Files:** `backend/src/friends/friends.controller.ts`,
  `backend/src/friends/friends.service.ts`,
  `backend/src/friends/friends.module.ts`,
  `backend/src/utils/friend.utils.ts`,
  `backend/src/types/friends.d.ts`,
  `backend/prisma/schema.prisma` (`model friends`) + migration
  `20260605162534_add_friends_initiator`.

This document **complements** `CODE_REVIEW_FINDINGS.md` and does not restate it.
Notify-side presence bugs (H1, H3, M2, M4) and the `getFreinds` typo (R6) are
already covered there — the findings below are new and specific to the friends
module. Line numbers are hints and will drift.

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · 🔧 Refactor · ⚙️ Process.

---

## ✅ Verification pass — 2026-07-23

All findings re-checked against the working tree — all confirmed present. Note this
reviewer correctly accounted for the global `PrismaExceptionFilter`: F2 states 409
(not 500), matching `test/friends.e2e-spec.ts:112` (duplicate → 409) and `:120`
(missing → 404).

| ID | Verdict | Note |
|----|---------|------|
| F1 | ✅ Confirmed | `deleteFriend` branches on status, not on who acted. |
| F2 | ✅ Confirmed | Nonexistent target → P2003 → **409** (misleading; should be 404). Status claim is correct. |
| F3 | ✅ Confirmed | Presence hooks early-return when monitor offline. |
| F4 | ✅ Confirmed | Duplicate/reverse request → generic 409. |
| F5 | ✅ Confirmed | `getFriends` throws 500 for deleted-self. |
| F6 | ✅ Confirmed | Accept-own-request guard order (trivial). |
| F7 | ✅ Confirmed | Duplicate `@ApiResponse` 409 entries. |
| F8 | ✅ Confirmed | `getFreinds`/`getFriends` merge duplicated. |
| F9 | ✅ Confirmed | `FRIENDS_TITEL`/`titel` typo. |
| F10 | ✅ Confirmed | Username lookup even when peer offline. |

No false positives.

---

## 🟠 High

### F1 — `deleteFriend` lets either party unilaterally delete, and swallows the "not found" case as 500-adjacent behavior
`backend/src/friends/friends.service.ts:127`

`deleteFriend` does an unconditional `prisma.friends.delete` on the canonical key.
Because `getFriendsKey` always resolves to a record that includes the caller, a
third party cannot delete someone else's friendship — that part is correct. But
there is no distinction between the two legitimate delete semantics:

1. The **recipient** of a still-`pending` request calls DELETE → this silently
   *rejects/declines* the request, yet the peer (the initiator) is notified with
   `FRIEND_REQUEST_REMOVED` — the same message an initiator gets when they cancel
   their own request. The initiator can't tell "I cancelled" from "they declined".
2. The **initiator** deleting a pending request (cancel) and either party deleting
   an accepted friendship (unfriend) all funnel through the same code.

Only the `status === 'accepted'` vs. else branch differentiates the notify text,
not *who* acted, so notifications are ambiguous.

**Fix:** branch on `deletedFriend.initiatorId === payload.sub` (and status) to send
the correct message (cancelled / declined / unfriended) to the right peer.

### F2 — Adding a friend to a non-existent user returns a misleading 409
`backend/src/friends/friends.service.ts:70` + `backend/src/filter/prisma-exception.filter.ts:21`

`addFriend` never checks that `id` refers to a real user. `prisma.friends.create`
with a bogus `userBId`/`initiatorId` fails the FK constraint (P2003), which the
global `PrismaExceptionFilter` maps to `409 Conflict "Foreign key constraint
failed"`. So requesting a deleted/never-existent user yields a 409 that is
indistinguishable from the duplicate-friendship 409 (P2002) and carries a
DB-internal message. The controller even documents this as `409 The user ID is
invalid`, which is semantically a 404/400.

**Fix:** look the target user up first and throw `NotFoundException` when absent
(mirrors how other services validate the peer), so duplicate (409) and
unknown-user (404) are distinguishable and don't leak DB error text.

---

## 🟡 Medium

### F3 — Presence hooks on accept/delete are best-effort and silently partial
`backend/src/friends/friends.service.ts:115,136` → `notify.service.ts:41,49`

`addUserToOnlineStatus`/`rmUserFromOnlineStatus` each early-return when the
*monitoring* user has no live socket (`userStatus.get(...) === undefined`). On
`acceptFriendship`, if the accepter is online but the peer is offline (or vice
versa), only one side's status-watch room is wired up; the other side never gets
subscribed until some later event re-runs the flow. There is no reconciliation on
(re)connect for already-accepted friends — a user coming online does not
retroactively register presence-watching for their existing friends. Combined
with the notify-side M4 (subscriptions lost on reconnect), presence for existing
friendships is effectively never established through this path alone.

**Fix:** on socket connect, seed the status-watch rooms from the user's accepted
friends (the notify gateway already calls `getFreinds` for `watch-friends-status`;
`acceptFriendship`'s incremental hook is redundant with that if connect-time
seeding is correct). At minimum, document that these hooks only cover the
"both online at accept time" case.

### F4 — Duplicate / reverse-direction request is a raw 409 with no domain message
`backend/src/friends/friends.service.ts:70`

Because the PK is the canonical `(userAId, userBId)` pair, if B has already sent
A a pending request and A then sends B a request, `create` hits P2002 → global
filter → `409 "The record already exists"`. Functionally this prevents duplicates
(good — the ordering via `getFriendsKey` is correct and symmetric), but the caller
gets a generic message and no signal that "this person already requested you;
accept instead". No `addFriend` path re-checks or auto-accepts a reverse pending
request.

**Fix:** before/instead of relying on the P2002 filter, `findUnique` on the key
and throw a `ConflictException` with a friends-specific message (and optionally
surface "there is already a pending request from this user").

### F5 — `getFriends` uses a 500 for a self-lookup that returns null
`backend/src/friends/friends.service.ts:42`

`getFriends` throws `InternalServerErrorException` when
`prisma.users.findUnique({ id: payload.sub })` is null. For an authenticated user
whose row was deleted (valid JWT, gone user — the M10 scenario), listing friends
returns a 500 rather than a 401/404. It's a self lookup, so null == deleted user,
not a server fault.

**Fix:** throw `UnauthorizedException`/`NotFoundException` (consistent with the
M10 fix) instead of `InternalServerErrorException`.

---

## 🔵 Low

### F6 — `acceptFriendship` accept-your-own-request guard is order-dependent and partly redundant
`backend/src/friends/friends.service.ts:98`

The guard `status === 'pending' && initiatorId === payload.sub` is fine, but the
subsequent `status === 'accepted'` check means an already-accepted request by the
*initiator* returns "Friendship is already accepted" rather than "you cannot
accept your own request" — minor UX inconsistency. Also, there is no explicit
`else` for an unexpected status value (the enum is only `pending`/`accepted`, so
this is defensive only).

**Fix:** none required for correctness; optionally reorder so the
self-accept message wins, or collapse the checks.

### F7 — Controller Swagger `@ApiResponse` set is inaccurate
`backend/src/friends/friends.controller.ts:26-28,41-44`

Duplicate `409` entries on `addFriend` (two `@ApiResponse({ status: 409 })`), and
`acceptFriendship`/`deleteFriend` document `400 "You can't be friends with
yourself."` which is technically emitted but the documented 404/409 semantics for
the unknown-user case don't match what actually happens (see F2). Swagger tooling
keeps only one entry per status code, so the "invalid user ID" 409 note is lost.

**Fix:** align the documented responses with real behavior once F2/F4 land;
de-duplicate the status codes (use distinct codes or a single combined description).

---

## 🔧 Refactor / cleanup

### F8 — `getFreinds` (typo) and `getFriends` do the same work, duplicated
`backend/src/utils/friend.utils.ts:25` vs `backend/src/friends/friends.service.ts:36`

Beyond the R6-noted spelling, `FriendUtils.getFreinds` (returns `number[]` of
accepted friend IDs) and `FriendsService.getFriends` (returns `Friend[]`) both
re-implement the `friendsA`/`friendsB` merge with the same `userBId`/`userAId`
select logic. The canonical-pair unpacking should live in one helper.

**Fix:** extract a single "list friends of user" query/helper and have both
callers project from it; rename to `getFriends` when doing so.

### F9 — `FRIENDS_TITEL` typo propagated into every friend notification
`backend/src/friends/friends.service.ts:12,80,120` (and the `titel` field on `NotifyMsg`)

Every `sendNotify` call from friends uses `titel:` and the `FRIENDS_TITEL`
constant. This is the friends-side manifestation of the R6 `titel → title` typo —
flagged here because renaming the shared `NotifyMsg` field touches all four
`sendNotify` sites in this file.

**Fix:** rename `titel` → `title` on the shared type and update these call sites
together with the constant `FRIENDS_TITEL` → `FRIENDS_TITLE`.

### F10 — Repeated `getUser(payload.sub).username` lookup per mutation
`backend/src/friends/friends.service.ts:78,118,139`

Each of add/accept/delete does an extra DB round-trip to fetch the actor's
username purely for the notification text, even when the peer is offline and the
notification is dropped. Minor, but avoidable.

**Fix:** fetch lazily only when a notification will actually be sent, or carry the
username on the JWT payload if it's already available there.

---

## Notes / verified-correct (not findings)

- **Canonical ordering is correct.** `getFriendsKey(x, y)` sorts by `userXId <
  userYId`, so `(userAId, userBId)` is stable regardless of caller direction; the
  `@@id([userAId, userBId])` PK plus `initiatorId` cleanly separates "who is in
  the pair" from "who asked". No off-by-one / swap bug found in add/accept/delete
  or in the `getFriends` merge.
- **Authorization is sound for accept/delete.** Because every mutation keys on the
  canonical pair derived from `payload.sub`, a third party cannot accept or delete
  a friendship they aren't part of — the record simply won't be found for them.
- **Self-friend guard is present** on all three mutating endpoints
  (`payload.sub === id`).
- **`areFriends` correctly treats `pending` as not-friends** (`friend.utils.ts:19`).
</content>
</invoke>
