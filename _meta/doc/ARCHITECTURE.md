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
| Framework | Express + TypeScript | Decided |
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
