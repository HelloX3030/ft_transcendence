# Code Review — Auth / TOTP-MFA / Crypto

Focused backend review of the authentication, TOTP/MFA, and crypto layer.

- **Area:** token handling, session table usage, guard/strategy logic, TOTP
  setup/activate/delete flow, secret handling, DTO validation.
- **Files:** `backend/src/auth/*` (controller, service, module, guards,
  strategies, dto), `backend/src/utils/otp.utils.ts`,
  `backend/src/utils/crypto.utils.ts`, `backend/src/utils/dto/otp.dto.ts`,
  the `mfa/totp/*` endpoints in `backend/src/users/users.{controller,service}.ts`,
  `backend/prisma/migrations/20260622144913_add_totp/`.
- **Reviewed:** 2026-07-23 against the working tree on `main`.

This document **complements** `CODE_REVIEW_FINDINGS.md` — it does **not** restate
findings already recorded there. In particular the following are already covered
and are intentionally omitted here: H5 (no TOTP clock-skew window), M5 (plaintext
password held across the MFA step), M6 (no rate limiting / no TOTP replay
tracking), M7 (unauthenticated AES-256-CBC), M10 (`/users/me` 200 for a deleted
user + jwt strategy echoes payload with no DB lookup), P1 (`add_totp` migration
`NOT NULL` with no default).

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · 🔧 Refactor · ⚙️ Process.
Line numbers are hints and will drift.

---

## ✅ Verification pass — 2026-07-23

All twelve findings re-checked against the working tree — all confirmed present.

| ID | Verdict | Note |
|----|---------|------|
| A1 | ✅ Confirmed | `deleteTOTP` does a bare `update`, no re-auth. |
| A2 | ✅ Confirmed | JWT/MFA secrets `Joi.string().required()`, no length/hex floor. |
| A3 | ✅ Confirmed | `secret` computed, never returned; Swagger promises it. |
| A4 | ✅ Confirmed | `secure: false` on both cookies (explicit TODO). |
| A5 | ✅ Confirmed | `refresh` never checks `session.userId === payload.sub`. Correctly scoped as defense-in-depth (not exploitable without the signing key). |
| A6 | ✅ Confirmed | Login returns before `argon2.verify` on unknown email — timing oracle. |
| A7 | ✅ Confirmed | `console.error` on security paths. |
| A8 | ✅ Confirmed | `activateTOTP` `updateMany` omits `totpActive: false`. |
| A9 | ✅ Confirmed | `@ApiBody` example `otp: 213846` (number) fails `@IsString`. |
| A10 | ✅ Confirmed | `if (x) return true; else return false` redundancy. |
| A11 | ✅ Confirmed | `JwtRefreshGuard` injects an unused `Reflector`. |
| A12 | ✅ Confirmed | IV-split encode/decode hand-rolled in 2+ places. |

No false positives. A1 remains the one to fix first.

---

## 🟠 High

### A1 — Disabling MFA requires no re-authentication
`backend/src/users/users.controller.ts:149` → `users.service.ts:244` (`deleteTOTP`)

`DELETE /users/mfa/totp` clears `totpSecret` and sets `totpActive = false` on the
strength of nothing more than a valid **access token** — no password, no current
TOTP code. TOTP exists precisely to protect an account whose password/cookie may
be compromised; letting the same session silently strip the second factor negates
that protection. An attacker with a stolen access cookie (15-min window, but see
A2) can turn MFA off and then change nothing prevents a full takeover. This is the
weakest link in the whole MFA flow: setup and activation are gated, teardown is not.

**Fix:** require a fresh credential on disable — re-verify the current password or
a valid TOTP code (add a body DTO and check it in `deleteTOTP`) before clearing
the secret.

---

## 🟡 Medium

### A2 — JWT/MFA secrets accepted with no minimum strength
`backend/src/app.module.ts:24-25,33`

`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `MFA_KEY` are validated only as
`Joi.string().required()`. A one-character `JWT_ACCESS_SECRET` passes validation
and the app boots — every access/refresh token is then trivially forgeable.
`MFA_KEY` *is* re-checked for `length === 64` at first use in
`crypto.utils.ts:8`, but that only throws lazily on the first TOTP operation,
not at startup, and the JWT secrets have no length check at all.

**Fix:** tighten the schema — `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` →
`Joi.string().min(32).required()`; `MFA_KEY` →
`Joi.string().length(64).hex().required()` so a bad key fails fast at boot rather
than mid-request.

### A3 — `createTOTP` never returns the plaintext secret it advertises
`backend/src/users/users.service.ts:189,209` + Swagger at
`users.controller.ts:110`

`const secret = totp.secret.base32;` is computed, encrypted, and stored, but the
method returns `successResponse(qrCode)` only. The Swagger doc promises "Returns
QR code **and secret**". Authenticator apps that can't scan a QR (manual entry)
have no way to get the base32 key, and the API contract is wrong.

**Fix:** either return `{ qrCode, secret }` (manual-entry support) and update the
response type, or drop "and secret" from the Swagger description if hiding it is
intentional. Decide and align code + docs.

### A4 — Access cookie carries a 15-day-usable session but a 15-min token
`backend/src/auth/auth.service.ts:231` vs the session row TTL

`setCookies` sets the `access_token` cookie `maxAge` to 15 min and the JWT
`expiresIn` to `15m` — consistent. But note `secure: false` on **both** cookies
with an explicit `// todo: set to true`. With `sameSite: 'strict'` the exposure is
limited, but shipping auth cookies without `Secure` means any accidental
plaintext-HTTP request (or a downgrade) leaks both tokens. This is a real
pre-production gate, not just a nit.

**Fix:** drive `secure` from an env/`NODE_ENV` flag so it is `true` in any
non-local deployment; don't rely on remembering the TODO.

### A5 — `refresh` never checks the session belongs to the token's subject
`backend/src/auth/auth.service.ts:92-116`

`refresh` looks up the session by `payload.sessionId`, verifies
`session.sessionHash` against `payload.session`, then loads the user by
`payload.sub` — but never asserts `session.userId === payload.sub`. Because the
refresh JWT is signed, forging a mismatched pair requires the secret, so this is
defense-in-depth rather than an open hole; still, the session row already carries
`userId` and the check is one line. Its absence means a signing-key compromise or
any future path that mints a payload from partial data would let a session be
bound to the wrong user.

**Fix:** after loading the session, `if (session.userId !== payload.sub) throw new
ForbiddenException(...)`, and issue the new tokens from `session.userId` rather
than trusting `payload.sub`.

### A6 — Login exposes a user-enumeration timing/response oracle
`backend/src/auth/auth.service.ts:62-70`

For a non-existent email the handler returns immediately (`user === null`) without
running `argon2.verify`; for a real email it always pays the Argon2 cost. The
measurable timing difference (and identical-but-differently-timed
`Invalid credentials` responses) lets an attacker enumerate registered emails.

**Fix:** run a dummy `argon2.verify` against a constant hash on the
user-not-found branch to equalize timing (or accept the risk explicitly given
`register` already discloses taken emails via the `403` — but then that
disclosure is itself worth revisiting).

---

## 🔵 Low

### A7 — TOTP secret error paths use `console.error` instead of the Nest logger
`backend/src/auth/auth.service.ts:80`, `users.service.ts:177`,
`crypto.utils.ts:9`

The MFA/crypto paths log via raw `console.error` while the rest of `AuthService`
uses an injected `Logger`. Inconsistent, bypasses Nest log formatting/levels, and
these fire on security-relevant states (TOTP enabled with no secret, missing
`APP_NAME`, malformed `MFA_KEY`).

**Fix:** use the class `Logger` (or a passed logger in the util) so these land in
the same stream at `error` level.

### A8 — `activateTOTP` is not idempotency-guarded against an already-active secret
`backend/src/users/users.service.ts:224-237`

The concurrency guard (`updateMany where totpSecret = user.totpSecret`) protects
against a secret swap mid-activation, but the `where` clause does not include
`totpActive: false`. Re-posting a valid code to `mfa/totp/activate` for an
already-active user re-runs the update and returns "activated successfully"
again. Harmless today (no counter/replay tracking — see M6), but once replay
protection lands this becomes an inconsistent state to reason about.

**Fix:** add `totpActive: false` to the `updateMany` `where`, so a second
activation is a clean no-op/conflict rather than a silent success.

### A9 — `otp` validation allows a non-numeric-typed value on activate
`backend/src/utils/dto/otp.dto.ts:6-9`; Swagger example is numeric
(`users.controller.ts:125` shows `otp: 213846`)

`otpDto.otp` is `@IsString()` + `@Matches(/^[0-9]{6}$/)`, so a JSON number
(`213846`, exactly as the Swagger `@ApiBody` example advertises) fails `@IsString`
and is rejected with a `400`. The example in the API docs is therefore literally
invalid input. Minor, but confusing for API consumers.

**Fix:** make the Swagger example a string (`otp: '213846'`) so the documented
payload matches the DTO.

---

## 🔧 Refactor

### A10 — `verifyTOTP` reimplements a boolean the library already returns
`backend/src/utils/otp.utils.ts:23-24`

`if (totp.generate() === otp) return true; else return false;` is `return
totp.generate() === otp`. This will be replaced anyway when H5 (clock-skew) is
fixed with `totp.validate({ token: otp, window: 1 }) !== null`, but flagging the
redundancy so it is cleaned up rather than copied.

### A11 — `JwtRefreshGuard` injects an unused `Reflector`
`backend/src/auth/guard/jwt.refresh.guard.ts:7-9`

The constructor takes `private reflector: Reflector` and calls `super()`, but the
guard never reads metadata (unlike `JwtAccessGuard`, which uses it for `@Public`).
Dead dependency.

**Fix:** drop the constructor and the `Reflector` import.

### A12 — `createTOTP` / `activateTOTP` duplicate the `select` + null-guard boilerplate
`backend/src/users/users.service.ts:163-241`

Both re-fetch the user, both throw `NotFoundException`, both compute/decrypt the
secret with near-identical IV-split logic (also duplicated in
`otp.utils.decryptTOTPSecret`). The IV-prefix encoding (`ivHex + ':' + cipher`)
is hand-rolled in two places.

**Fix:** centralize the encode/decode of the stored secret in `crypto.utils`
(a single `encryptSecret`/`decryptSecret` pair that owns the `iv:cipher` format),
so the CBC→GCM migration in M7 touches one function, not three call sites.

---

## Notes / confirmed-OK

- **Global guard wiring is correct.** `JwtAccessGuard` is registered as an
  `APP_GUARD` (`app.module.ts:54`) and honors `@Public()`, so all `mfa/totp/*`
  endpoints are authenticated by default — no missing-guard hole there.
- **Session cleanup** (`@Interval` every 5 min, `auth.service.ts:242`) correctly
  deletes expired sessions and swallows its own errors.
- **`createTOTP` overwrite guard** (`updateMany where totpActive: false`) correctly
  prevents clobbering an already-active secret during re-setup.
- **`deleteTOTP` lacks a null/existence guard** but `update` on a missing id throws
  `P2025` → 500; not exploitable, just an ugly error. Low enough to fold into A1's
  rewrite.
