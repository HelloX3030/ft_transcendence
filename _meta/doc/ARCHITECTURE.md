# TrailerTinder — Architecture & Tech Decisions

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
| Icons | Lucide Vue Next | Decided |

---

## Backend

| Item | Decision | Status |
|---|---|---|
| Framework | NestJS + TypeScript | Decided |
| ORM | Prisma | Decided |
| Database | PostgreSQL 16 | Decided |
| Auth strategy | OAuth 2.0 — Google + 42 | Decided |
| Auth library | TBD (passport.js or custom) | Open |
| WebSocket library | TBD (socket.io vs native ws) | Open |

---

## Authentication

**OAuth 2.0 with two providers:**
- Google OAuth (general audience)
- 42 OAuth (school requirement)

No email/password login. Avatar upload is supported post-login.

**Library TBD** — passport.js is the common choice but adds abstraction overhead; a custom implementation using the provider SDKs directly is also viable.

---

## Real-time (WebSockets)

Required for:
1. Movie Night Mode — live group swipe session + ranking
2. Friend online status
3. 1:1 chat

**Library TBD:**
- `socket.io` — higher-level, rooms/namespaces built-in, easier to implement Movie Night sessions, but adds ~50 kB to client bundle
- `ws` (native WebSocket) — minimal, faster, but requires manual room/broadcast logic

---

## Movie Data & Trailers

| Source | Status | Notes |
|---|---|---|
| Movie metadata | TMDB API | Provisional — needs API key |
| Trailers | YouTube embeds | Provisional — check ToS for auto-play use case |

**Open:** Catalog scoping logic (which films surface, popularity threshold, streaming availability filter).

---

## Infrastructure

| Item | Decision | Status |
|---|---|---|
| Containerization | Docker | Decided |
| Local orchestration | docker-compose | Decided |
| Hosting / deployment | TBD | Open |
| PWA | TBD | Open |

## Dev Setup

```
docker compose up --build
```

- App: `https://localhost:8443` (Vite dev server + HMR, behind Caddy)
- Backend API: `https://localhost:8443/api` (tsx --watch, behind Caddy)
- Swagger: `https://localhost:8443/api/docs`
- PostgreSQL: `localhost:5432`

A Caddy reverse proxy terminates TLS and is the only web port published to the host. It routes `/api/*` to `backend:3000` with the prefix stripped, and everything else to `frontend:5173`, so the whole app lives on one origin — one self-signed-certificate warning to click through, and no cross-origin API calls being silently blocked. Caddy proxies websocket upgrades (Vite HMR, socket.io) without extra configuration. Ports `5173`, `3000` and `9000` are not published; `5432` (Postgres) and `5050` (pgAdmin) remain exposed as developer tools. The proxy sits on `8443`/`8080` rather than `443`/`80` because the school machines run rootless Docker, which cannot publish privileged ports.

---

## Code Quality & Formatting

Three-layer pipeline: editor → pre-commit hook → CI. See [`_meta/notes/02-formatting-pipeline.md`](../notes/02-formatting-pipeline.md) for the full reference.

| Tool | Role | Scope |
|---|---|---|
| **Prettier** | Formatting (whitespace, quotes, line endings) | All files |
| **ESLint** | Code correctness, type-safety rules | `.ts`, `.vue` |
| **oxlint** | Fast linter (subset of ESLint rules, no false positives) | Frontend only |
| **husky + lint-staged** | Pre-commit hook — runs ESLint + Prettier on staged files only | Both packages |
| **GitHub Actions** | CI gate — format:check, lint, type-check, unit tests on every PR | Both packages |

**Shared config at repo root:**
- `.prettierrc` — single source of truth for formatting rules (`singleQuote`, `trailingComma`, `endOfLine: lf`, `printWidth: 100`); inherited by both `frontend/` and `backend/`
- `.gitattributes` — enforces LF line endings in git (must match `endOfLine: lf` in Prettier to avoid churn)

**Per-package ESLint configs** (`frontend/eslint.config.mjs`, `backend/eslint.config.mjs`) — flat config format (ESLint 9+). Both include `eslint-config-prettier` to disable formatting rules, deferring entirely to Prettier.

**Key constraint:** Prettier and ESLint must never configure the same rules. `eslint-config-prettier` is the last entry in both ESLint configs to enforce this.

**Developer first-time setup** — after cloning, run `npm install` at the repo root to activate the pre-commit hook via husky's `prepare` script. Without this, git hooks don't exist on the local machine.
