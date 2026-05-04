# TrailerTinder — Implementation Roadmap

14 mandatory MVP points mapped to implementation phases, ordered by dependency.
See [MVP_Features.md](../product/MVP_Features.md) for the full feature list.
See [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) for what must be resolved before each phase starts.

---

## Phase Overview

```
Phase 0 — Foundation
  └── Phase 1 — Auth & Users
        ├── Phase 2 — Core Feed
        └── Phase 3 — Social
              ├── Phase 4 — Recommendation Engine
              └── Phase 5 — Movie Night Mode
Phase 6 — GDPR (can run in parallel with Phase 5)
```

---

## Phase 0 — Foundation

**What:** Repo structure, Docker setup, base Express server, base Vue routing, database.

**Before starting:** Resolve database choice and hosting target (see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)).

**Deliverables:**
- `docker-compose.yml` with `frontend`, `backend`, `db` services
- Express server running on `:3000` with a `/health` endpoint
- Prisma connected to the database with an empty schema
- Vue Router with placeholder routes for all top-level pages
- Vite proxy `/api` → backend

**MVP modules covered:** Module 1 (Frontend + Backend Framework) — 2 pts

---

## Phase 1 — Auth & User Management

**What:** OAuth login, user profiles, avatar upload, online status infrastructure.

**Depends on:** Phase 0

**Before starting:** Confirm OAuth provider credentials (Google client ID, 42 client ID).

**Deliverables:**
- OAuth 2.0 login (Google + 42) — session or JWT-based
- User model in Prisma (id, provider, name, avatar, preferences)
- Onboarding flow: top-5 films + genre/director/actor preferences
- Avatar upload (with default fallback)
- Settings page for updating preferences
- Online status tracking (presence via WebSocket or polling)

**MVP modules covered:** Module 4 (User Management) + Module 7 (OAuth 2.0) — 3 pts

---

## Phase 2 — Core Feed & Watchlist

**What:** The main trailer swipe feed — the core value proposition.

**Depends on:** Phase 1 (need a logged-in user to record swipes)

**Before starting:** Confirm TMDB API key and YouTube embed approach (see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)).

**Deliverables:**
- TMDB API integration: fetch movie metadata + trailer URLs
- Vertical full-screen trailer feed (TikTok-style, autoplay)
- Swipe actions: Like / Dislike / Save
- Swipe history stored in DB (needed for recommendations later)
- Personal watchlist (saved films)

**MVP modules covered:** Part of Module 1 (Frontend), Module 6 (ORM) — contributes to 1 pt

---

## Phase 3 — Social (Friends, Chat, Notifications)

**What:** Friends system, 1:1 chat, friend requests, notifications.

**Depends on:** Phase 1

**Deliverables:**
- Friend request / accept / remove flow
- Friends list with online status display
- 1:1 text chat between friends (WebSocket)
- Notifications: friend requests, Movie Night invitations
- Notification bell in navbar with unread count

**MVP modules covered:** Module 3 (User Interaction) + Module 8 (Notifications) — 3 pts

---

## Phase 4 — Recommendation Engine

**What:** ML-based film recommendations using collected swipe data.

**Depends on:** Phase 2 (needs swipe history data), Phase 1 (user preferences)

**Before starting:** Decide on recommendation approach (see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)).

**Deliverables:**
- Recommendation service that scores films per user
- Explicit signal integration (genres, directors, actors from profile)
- Implicit signal integration (likes, dwell time, skip speed)
- Feed ordering based on recommendation scores

**MVP modules covered:** Module 5 (Recommendation System ML) — 2 pts

---

## Phase 5 — Movie Night Mode

**What:** Real-time group swipe sessions with live result ranking.

**Depends on:** Phase 1 (users), Phase 2 (feed), Phase 3 (friends)

**Before starting:** Decide on WebSocket library (see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)).

**Deliverables:**
- Create session + invite friends flow
- WebSocket-based room: all participants swipe the same film queue simultaneously
- Live ranking: films sorted by overlap count in real time
- Session end screen with top results

**MVP modules covered:** Module 2 (Real-time WebSockets) — 2 pts

---

## Phase 6 — GDPR Compliance

**What:** Data export and full account deletion.

**Depends on:** Phase 1 (user model must be complete)
**Can run in parallel with:** Phase 5

**Deliverables:**
- Data export endpoint (user profile, swipe history, watchlist, chat logs) as JSON or ZIP
- Full account deletion: removes all user data from DB, revokes OAuth tokens
- UI: settings page entry points for both actions

**MVP modules covered:** Module 9 (GDPR) — 1 pt

---

## MVP Points Summary

| Phase | Modules | Points |
|---|---|---|
| 0 | Framework setup | 2 |
| 1 | User Management + OAuth | 3 |
| 2 | Core feed + ORM | 1 |
| 3 | User Interaction + Notifications | 3 |
| 4 | Recommendation Engine ML | 2 |
| 5 | Real-time WebSockets | 2 |
| 6 | GDPR | 1 |
| **Total** | | **14** |

---

## Bonus Modules (Post-MVP)

Once all 14 points are done, possible additions (up to +5 pts):

| Feature | Module | Points |
|---|---|---|
| 2FA | Security | +1 |
| Multi-language i18n (3+ languages) | i18n | +1 |
| Custom Design System (10+ components) | Design | +1 |
| Sentiment analysis on comments | AI | +1 |
| Shared watchlists with voting | Collaborative | +1 |
| WAF + Vault | DevOps | +2 |
