# Code Review — Users module

Focused backend review of the **users** module: onboarding, avatar upload, profile
update, search, and the recommendation user fields. **Excludes** MFA/TOTP routes
(covered separately).

**Files reviewed:**
- `backend/src/users/users.controller.ts` (non-MFA routes)
- `backend/src/users/users.service.ts` (non-TOTP methods)
- `backend/src/users/dto/{onboarding,search-users,update-user,index}.ts`
- `backend/src/storage/{storage.module,storage.service}.ts`
- `backend/prisma/schema.prisma` (recommendation fields) + migration
  `20260624115724_add_recommendation_fields`

This document **complements** `CODE_REVIEW_FINDINGS.md`; it does **not** repeat its
findings. In particular it does **not** restate **M10** (`getMe` returns 200 + empty
body for a deleted user — no null guard) or **H4** (frontend avatar upload not
awaited). Global config confirmed: `main.ts` runs a `ValidationPipe` with
`whitelist + forbidNonWhitelisted + transform`, and `JwtAccessGuard` is the global
`APP_GUARD`, so all these routes are authenticated and DTOs are whitelisted.

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · 🔧 Refactor · ⚙️ Process.
Line numbers are hints and will drift.

---

## ✅ Verification pass — 2026-07-23

All findings re-checked against the working tree. All confirmed present; one impact
caveat on U1.

| ID | Verdict | Note |
|----|---------|------|
| U1 | ✅ Confirmed, impact caveated | SVG-XSS primitive is real (only `mimetype.startsWith('image/')`; `ContentType` passthrough; public `s3:GetObject *` bucket — all confirmed in `storage.service.ts`). **But** the avatar is served from `MINIO_PUBLIC_URL`, a *different origin* than the app, so the script executes on the storage origin — it cannot directly read the app's cookies/DOM/localStorage. Real risk = phishing on the storage domain + a live hole *if* storage is ever same-origin/proxied. Keep the fix (allow-list + re-encode); treat severity as deployment-dependent, not automatic app-session theft. |
| U2 | ✅ Confirmed | `extname(file.originalname)` is client-controlled. |
| U3 | ✅ Confirmed | `updateMe` throws 403; global filter gives 409 everywhere else. |
| U4 | ✅ Confirmed | `completeOnboarding` unconditional, re-runnable, overwrites arrays. |
| U5 | ✅ Confirmed | `@ArrayMinSize(1)`, no max/`@Min(1)`/dedup. |
| U6 | ✅ Confirmed | `featureVector`/`featVecUpdatedAt` — zero code refs (grep). |
| U7 | ✅ Confirmed | Upload-before-update ⇒ orphan on DB failure. |
| U8 | ✅ Confirmed | `image` is a writable `@IsUrl()` field on `PATCH /me`. |
| U9 | ✅ Confirmed | `query` `@MinLength(1)`, no trim. |
| U10/U11 | ✅ Confirmed | Refactor items. |

---

## 🟠 High

### U1 — Stored-XSS avatar: SVG/HTML uploaded, served publicly with attacker's Content-Type
`users.controller.ts:63-68`, `users.service.ts:101-118`, `storage.service.ts:40-56,86-97`

The only upload validation is `file.mimetype.startsWith('image/')` in the multer
`fileFilter`. `image/svg+xml` passes. The service then stores the object with
`ContentType: file.mimetype` (client-supplied) into the MinIO bucket, whose policy
(`ensureBucket`) grants `s3:GetObject` to `*` (fully public). A crafted SVG containing
`<script>` is therefore served from the storage origin as `image/svg+xml` and executes
in any browser that navigates to the avatar URL — a stored-XSS primitive. `mimetype` is
purely client-controlled (multipart header), so there is no server-side content check at
all (no magic-byte sniff, no re-encode).

**Fix:** allow-list concrete raster types (`image/png`, `image/jpeg`, `image/webp`),
verify the actual bytes (magic number / `sharp` metadata) rather than the declared
mimetype, and never serve `svg`/`html` from the public bucket. Ideally re-encode the
image server-side before upload.

### U2 — Object key derived from attacker-controlled filename extension
`users.service.ts:108` — `` `${userId}-${Date.now()}${extname(file.originalname)}` ``

`extname(file.originalname)` takes the extension straight from the client. It feeds the
S3 `Key` and thus the public URL. A request with `originalname` like `x.svg`,
`x.html`, or an empty/multi-dot name controls the stored extension and the served file's
apparent type. Combined with U1 this widens the XSS/serving surface; on its own it lets a
user pin arbitrary extensions and produce inconsistent keys.

**Fix:** derive the extension from the *validated* content type, not from
`originalname` (e.g. map the sniffed mime → a fixed extension). Do not interpolate any
client string into the key.

---

## 🟡 Medium

### U3 — `updateMe` maps a unique-collision to 403 instead of 409, inconsistent with the app
`users.service.ts:91-98`

On `P2002` the service throws `ForbiddenException` (403) — "Email already taken" /
"Username already taken". Everywhere else, the global `PrismaExceptionFilter`
(`filter/prisma-exception.filter.ts`) maps `P2002` → **409 Conflict** ("The record
already exists"). So the same class of error returns 409 from every other write but 403
from `PATCH /users/me`. 403 also semantically means "forbidden", not "duplicate". The
controller's `@ApiResponse({ status: 403, description: 'Username already taken' })`
documents the wrong code.

**Fix:** throw `ConflictException` (409) and update the `@ApiResponse`; or drop the
local catch entirely and let `PrismaExceptionFilter` handle it (though the filter loses
the field-specific message).

### U4 — `completeOnboarding` is re-runnable and blindly overwrites preference fields
`users.service.ts:66-82`

The endpoint does an unconditional `update` setting `onboardingCompleted: true` plus the
three mock preference arrays. There is no guard against re-onboarding: any authenticated
user can `POST /users/me/onboarding` repeatedly, and each call **overwrites**
`genreIds/actorIds/directorIds` with the mock constants — clobbering whatever real
preferences a future recommendation pipeline may have written. The frontend guards this
in the router (`requiresOnboarding`), but the backend does not.

**Fix:** only stamp preferences when `onboardingCompleted` is still `false` (e.g.
`updateMany({ where: { id, onboardingCompleted: false }, ... })`), and decide whether
re-onboarding is allowed at all. Once real preference extraction exists, never overwrite
it from this path.

### U5 — Onboarding DTO too permissive; contradicts the frontend's "pick 10" contract
`dto/onboarding.dto.ts:11-14`

`movieIds` is `@IsArray @ArrayMinSize(1) @IsInt({ each: true })`. The UI
(`OnboardingView.vue:49`) requires **10** selections and disables submit below that, but
the backend accepts **1**. There is also no `@ArrayMaxSize`, no `@Min(1)` on the ids, and
no de-dup — a client can post `[0]`, `[-5]`, or a 100k-element array of duplicates, all
accepted. Since the ids currently feed nothing (mock values are stamped regardless), this
is latent, but it will matter the moment ids drive real preference extraction.

**Fix:** align the lower bound with the product rule (`@ArrayMinSize(10)` if that's the
contract), add `@ArrayMaxSize(...)`, `@Min(1)` on each id, and dedupe before use.

### U6 — Recommendation fields `featureVector` / `featVecUpdatedAt` are dead
`schema.prisma:78-79`, migration `20260624115724_add_recommendation_fields`

`featureVector Float[]` and `featVecUpdatedAt DateTime?` are declared and migrated but
**never written or read** anywhere in `backend/src` or `frontend/src` (verified by
grep). Only `genreIds/actorIds/directorIds` are used, and those only as mock stamps
(`completeOnboarding`) surfaced in `ProfileView.vue`. `featureVector` also has **no
default and no `?`** in the schema, so it is a required `Float[]` — every user row must
carry it; Prisma defaults an unset scalar-list to `[]`, but it's still carried columns
with zero consumers.

**Fix:** either wire these into the (still-TODO) recommendation pipeline or drop them
until the feature lands, to avoid dead schema. At minimum add a short comment marking
them as reserved-for-recs so they aren't mistaken for live data.

---

## 🔵 Low

### U7 — Orphaned storage object when the avatar DB update fails
`users.service.ts:108-117`

`upload()` writes the new object first, then `prisma.users.update` sets `image`. If the
update throws (e.g. the row was deleted between the read and the write → `P2025`), the
freshly-uploaded object is never deleted and leaks in the bucket. The old-file cleanup
(`delete(oldKey)`) also only runs after a successful update, so a mid-sequence crash
orphans files too. Low impact (storage leak, not a correctness bug for the user).

**Fix:** wrap the update in try/catch and delete the just-uploaded `key` on failure; or
update the DB first and upload/cleanup after.

### U8 — `PATCH /users/me` lets a user set an arbitrary external `image` URL
`dto/update-user.dto.ts:34-39`

`image` is an optional `@IsUrl()` string, so a user can point their avatar at **any**
external URL, bypassing the upload/validation/cleanup path entirely (and any content
checks from U1). It also means the avatar can reference a third-party host (privacy /
SSRF-adjacent for anything that later fetches it server-side). Whether this field should
be client-writable at all is worth confirming — avatars otherwise come only from
`POST /me/avatar`.

**Fix:** if avatars must come from storage, remove `image` from `UpdateUserDto`; if
external URLs are intentional, restrict the host/scheme and document it.

### U9 — Search term not trimmed; a single space is a valid query
`dto/search-users.dto.ts:9`, `users.service.ts:133-152`

`query` is `@MinLength(1)`, so `" "` (space) passes and runs a `contains: " "` scan.
Prisma parameterises the value so there's no injection risk, but whitespace-only /
untrimmed queries produce surprising broad matches and waste a full count+scan.

**Fix:** `@Transform(({ value }) => value?.trim())` before length validation (and
consider a slightly higher `@MinLength`).

---

## 🔧 Refactor

### U10 — Duplicated read-then-cleanup boilerplate in `uploadAvatar` and `deleteMe`
`users.service.ts:101-118, 120-131`

Both methods repeat the same "find current, `extractKey(current?.image)`, do the write,
then `if (oldKey) delete(oldKey)`" shape. Extract a small helper
(`cleanupAvatar(userId)` or similar) to keep the two in sync as storage logic evolves.

### U11 — Recommendation-mock constants and TODO live in the service body
`users.service.ts:36-42, 66-82`

The `MOCK_ONBOARDING_*` constants and the "replace with real preference extraction" TODO
are fine as a bridge, but they hardcode TMDB ids in the service. When the real pipeline
lands this whole `completeOnboarding` body is throwaway. Keep it isolated (it already is)
and track it against the "TMDB follow-ups" note so it isn't forgotten.

---

## Notes / confirmed-OK

- `getUser` (`users.service.ts:154-161`) **does** guard null and throws `NotFoundException`
  — good, and a nice contrast to the `getMe` gap already logged as M10.
- `deleteMe` (`120-131`) correctly reads the image first, deletes the row, then cleans up
  storage; `onDelete: Cascade` on relations handles dependent rows.
- `SearchUsersDto` pagination is well-bounded (`page ≥ 1`, `1 ≤ limit ≤ 50`, `@Type`
  coercion) and `searchUsers` excludes the requester and selects only `PUBLIC_SELECT`.
- Global `ValidationPipe` `whitelist + forbidNonWhitelisted` means no DTO here leaks
  extra fields; no whitelist gap found in this module.
- Multer uses `memoryStorage()` with a 5 MB `fileSize` limit — no disk path traversal via
  multer itself; the key-construction issue is U2, not a multer temp-path issue.
</content>
</invoke>
