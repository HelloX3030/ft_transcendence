# CineMates — Architecture & Tech Decisions

This document records all tech stack decisions: what was chosen, why, and what remains open. Update it whenever a decision is made or reversed.

---

## Frontend

| Item | Decision | Status |
|---|---|---|
| Framework | Vue 3 + Vite | Decided |
| Language | TypeScript | Decided |
| Styling | Tailwind CSS 4 (OKLCH color system) | Decided |
| Component library | Reka UI (headless) + shadcn-vue pattern | Decided |
| State management | Pinia | Decided |
| Routing | Vue Router | Decided |
| Icons | Lucide (`@lucide/vue`) | Decided |

---

## Backend

| Item | Decision | Status |
|---|---|---|
| Framework | NestJS + TypeScript | Decided |
| ORM | Prisma | Decided |
| Database | PostgreSQL 16 | Decided |
| Auth library | Passport (`passport-jwt`, `passport-google-oauth20`) | Decided |
| WebSocket library | socket.io via `@nestjs/websockets` | Decided |

---

## Authentication

| Item | Decision | Status |
|---|---|---|
| Local login | Email + password, argon2-hashed | Decided |
| Remote login | Google OAuth 2.0 | Decided |
| Two-factor | TOTP, own implementation (`qrcode` for enrolment) | Decided |
| Password reset | Emailed one-time token; OTP still required when TOTP is on | Decided |
| Session transport | JWT access + refresh tokens in httpOnly cookies | Decided |

Email + password is the subject's mandatory baseline; Google OAuth and TOTP are the *remote authentication* and *2FA* minor modules on top of it. Avatar upload is supported post-login.

---

## Real-time

| Item | Decision | Status |
|---|---|---|
| Library | socket.io via `@nestjs/websockets` | Decided |
| Surface | One `notify` namespace — 1:1 chat, friend online status, notifications | Decided |

Chosen over native `ws` for built-in rooms and namespaces; the ~50 kB client bundle cost was accepted.

---

## Movie Data & Trailers

| Item | Decision | Status |
|---|---|---|
| Movie metadata | TMDB API — server-side client, Redis-cached, request-budgeted | Decided |
| Trailers | YouTube IFrame API on the `youtube-nocookie` host | Decided |
| Catalog scoping | Poster + minimum vote count and average, in `tmdb/movie-filter.ts` | Decided |

---

## Infrastructure

| Item | Decision | Status |
|---|---|---|
| Containerization | Docker | Decided |
| Local orchestration | docker-compose | Decided |
| Reverse proxy | Caddy — terminates TLS, serves the whole app on one origin | Decided |
| Cache | Redis 7 | Decided |
| Object storage | MinIO (S3-compatible) | Decided |
| Mail (dev) | Mailpit | Decided |

---

## Code Quality & Formatting

| Tool | Role | Scope |
|---|---|---|
| **Prettier** | Formatting (whitespace, quotes, line endings) | All files |
| **ESLint** | Code correctness, type-safety rules | `.ts`, `.vue` |
| **oxlint** | Fast linter (subset of ESLint rules, no false positives) | Frontend only |
| **husky + lint-staged** | Pre-commit hook — runs ESLint + Prettier on staged files only | Both packages |
| **GitHub Actions** | CI gate — format:check, lint, type-check, unit tests on every PR | Both packages |
