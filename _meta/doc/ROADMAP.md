# TrailerTinder — Implementation Roadmap

```
Phase 0 — Foundation
  └── Phase 1 — Auth & Users
        ├── Phase 2 — Core Feed
        └── Phase 3 — Social
              ├── Phase 4 — Recommendation Engine
              └── Phase 5 — Movie Night Mode
Phase 6 — GDPR (parallel with Phase 5)
```

---

## Phase 0 — Foundation

- Docker setup: `frontend`, `backend`, `db` services
- Base Express server with `/health` endpoint
- Prisma connected to PostgreSQL with empty schema
- Vue Router with placeholder routes
- Vite `/api` proxy → backend

## Phase 1 — Auth & User Management

- OAuth 2.0 login (Google + 42)
- User model (id, provider, name, avatar, preferences)
- Onboarding: top-5 films + genre/director/actor preferences
- Avatar upload with default fallback
- Settings page for preference updates
- Online status tracking

## Phase 2 — Core Feed & Watchlist

- TMDB API integration (movie metadata + trailer URLs)
- Vertical full-screen trailer feed (autoplay)
- Swipe actions: Like / Dislike / Save
- Swipe history persisted to DB
- Personal watchlist

## Phase 3 — Social

- Friend request / accept / remove
- Friends list with online status
- 1:1 text chat (WebSocket)
- Notifications: friend requests, Movie Night invitations

## Phase 4 — Recommendation Engine

- Recommendation service scoring films per user
- Explicit signals: genres, directors, actors from profile
- Implicit signals: likes, dwell time, skip speed
- Feed ordering driven by scores

## Phase 5 — Movie Night Mode

- Create session + invite friends
- WebSocket room: all participants swipe the same queue in real time
- Live ranking by overlap count
- Session end screen with top results

## Phase 6 — GDPR

- Data export (profile, swipe history, watchlist, chat logs) as JSON/ZIP
- Full account deletion including OAuth token revocation
- Settings UI entry points for both actions
