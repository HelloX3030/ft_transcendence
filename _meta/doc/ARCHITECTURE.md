# TrailerTinder — Architecture & Tech Decisions

This document records all tech stack decisions: what was chosen, why, and what remains open. Update it whenever a decision is made or reversed.

---

## Decision Status Legend

- **Decided** — locked in, do not change without team discussion
- **Open** — not yet decided, see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)
- **Provisional** — working assumption, likely to stay but not fully confirmed

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

**Why Vue 3:** Team familiarity + excellent TypeScript support + Composition API maps well to the reactive swipe UI.

---

## Backend

| Item | Decision | Status |
|---|---|---|
| Framework | Express + TypeScript | Decided |
| ORM | Prisma | Decided |
| Database | TBD (PostgreSQL strongly recommended) | Open |
| Auth strategy | OAuth 2.0 — Google + 42 | Decided |
| Auth library | TBD (passport.js or custom) | Open |
| WebSocket library | TBD (socket.io vs native ws) | Open |

**Why Express:** Lightweight, well-understood, large ecosystem. Easy to add WebSocket support alongside HTTP routes.

**Why Prisma:** Type-safe client auto-generated from schema, excellent migration tooling, works with PostgreSQL / SQLite / MySQL. Database-agnostic until we finalize the DB choice.

---

## Database

**Status: Open** — see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md#database)

**Recommended: PostgreSQL 16**
- Relational model fits the data (users, friends, watchlists, swipe history)
- Native JSON support for flexible preference storage
- Works natively with Prisma
- docker-compose service is trivial to add

**Alternatives considered:**
- SQLite — fine for local dev, not suitable for multi-user concurrent writes in production
- MongoDB — document model adds complexity for the relational parts (friends, sessions)

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

## Recommendation Engine

**Status: Open** — biggest unknown in the stack.

Required inputs:
- Explicit preferences (genres, directors, actors from onboarding/settings)
- Implicit signals (likes, dwell time, skip speed, saves)

**Possible approaches:**
- Content-based filtering (similarity on film metadata)
- Collaborative filtering (users with similar taste liked X)
- Hybrid (content seed → collaborative refinement)

Decision deferred until the team has more clarity on data volume and available ML expertise.

---

## Infrastructure

| Item | Decision | Status |
|---|---|---|
| Containerization | Docker | Decided |
| Local orchestration | docker-compose | Decided |
| Hosting / deployment | TBD | Open |
| PWA | TBD | Open |

**docker-compose** will define three services: `frontend`, `backend`, `db`.
This has not been implemented yet — it is part of the next phase (tech setup).
