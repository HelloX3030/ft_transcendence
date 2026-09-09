*This project has been created as part of the 42 curriculum by cwolf, mausperg, phofmann, lseeger, lkubler.*

# CineMates

> Find your next film the way you find everything else now — by swiping through trailers.

CineMates is a mobile-first web application for deciding **what to watch**. Instead of reading synopses in a grid of posters, you watch short trailers one after another and react to each one. A machine-learning recommendation engine turns those reactions into a taste profile and keeps refining the feed. What you like lands in watchlists you can share with friends, so the group decision happens in the app instead of in a group chat.

**In a hurry?** Jump to [Instructions](#instructions) — the whole stack is one `docker compose up --build`.

---

## Table of Contents

- [Description](#description)
- [Features List](#features-list)
- [Modules](#modules)
- [Technical Stack](#technical-stack)
- [Database Schema](#database-schema)
- [Team Information](#team-information)
- [Project Management](#project-management)
- [Individual Contributions](#individual-contributions)
- [Instructions](#instructions)
- [Known Limitations](#known-limitations)
- [Resources](#resources)
- [Repository Layout](#repository-layout)

---

## Description

Choosing a film takes longer than watching one. Streaming catalogues are enormous, the metadata all looks the same, and a group of friends will happily spend forty minutes scrolling past the thing they would all have enjoyed. CineMates attacks that problem from two directions at once.

**A trailer is a better signal than a synopsis.** The core of the app is a vertical feed of trailers. You watch, you swipe — like or dislike — and the next one starts. Reactions are cheap to give and, crucially, they are *honest*: nobody lies to a trailer the way they talk themselves into a five-star rating. The engine also records how long you actually watched before swiping, which separates "not for me" from "not for me, and I knew within three seconds".

**The decision is social.** Every user has a profile, a friends list with live online status, and one-to-one chat. Watchlists are collaborative: you can add friends as editors or viewers, and everyone sees additions and removals as they happen, with in-app notifications for anything they missed while away.

Behind the feed sits a dedicated Python recommendation service that blends collaborative filtering with content-based scoring, then deliberately diversifies the result so the feed does not collapse into ten variations of the last film you liked. Movie metadata, posters and trailers come from **TMDB**, cached in Redis and served through a request budget so the shared API key survives a room full of evaluators.

### Key features at a glance

| | |
|---|---|
| 🎬 **Trailer feed** | Swipe through trailers; like/dislike and watch-time feed the recommender |
| 🤖 **ML recommendations** | Collaborative + content-based scoring with diversification |
| 🔎 **Discover & search** | Filter by genre, year range and sort order; paginated results |
| 👥 **Friends & presence** | Requests, accept/decline, live online status over WebSockets |
| 💬 **Chat** | Real-time 1:1 messaging with history, unread counts and read receipts |
| 📋 **Shared watchlists** | Collaborative lists with editor/viewer roles |
| 🔔 **Notifications** | Persisted in-app notifications for friend and watchlist events |
| 🔐 **Secure accounts** | Argon2id passwords, JWT sessions, Google OAuth 2.0, TOTP 2FA |
| 🖼️ **Avatar uploads** | Validated, magic-byte-checked uploads stored in MinIO |
| 📱 **Responsive UI** | Mobile-first, works from a phone up to a wide desktop |

---

## Features List

Attribution names the person who **drove** each feature. Almost everything was reviewed by at least one other member before it reached `main`.

### Authentication & Account Security

| Feature | Description | Driven by |
|---|---|---|
| Email/password registration & login | Passwords hashed with **argon2id**; every input validated on both client and server | mausperg |
| Session management | JWT access + refresh tokens in `httpOnly` cookies, refresh-token rotation, replay detection with a grace window for racing tabs, absolute session lifetime | mausperg, lseeger |
| Google OAuth 2.0 sign-in | Server-side code exchange; a Google account with no local password is a first-class account | mausperg |
| Two-factor authentication (TOTP) | QR enrolment, encrypted secret at rest, counter tracking so a captured code cannot be replayed | lseeger |
| Password reset | Single-use, expiring token sent by email; still requires the OTP when 2FA is on | mausperg |
| Account deletion | Removes the account and cascades to all owned data | mausperg |
| Rate limiting | Named throttling windows — burst, sustained, and a stricter per-IP window on credential endpoints | lseeger |

### Movies, Feed & Discovery

| Feature | Description | Driven by |
|---|---|---|
| Trailer feed | Vertical swipe feed with an embedded YouTube player on the `youtube-nocookie` host | phofmann, cwolf |
| Reactions & watch time | Like/dislike per movie plus seconds watched, stored as the recommender's ground truth | lkubler, lseeger |
| Recommendation engine | Python/FastAPI service: collaborative filtering, content-based scoring, engagement weighting and diversification | lkubler |
| Recommender integration | Wiring the engine to the NestJS backend and to TMDB candidate retrieval | lseeger, lkubler |
| Onboarding | New users pick favourite genres to seed a cold-start profile | mausperg, phofmann |
| Discover & advanced search | Genre, year-range and sort filters, sort direction, pagination; separate user search | lseeger |
| Movie detail pages | Cast, crew, runtime, ratings and streaming-provider availability from TMDB | lseeger, cwolf |
| TMDB layer | Server-side client with Redis caching and a request budget; quality thresholds enforced server-side | lseeger, mausperg |

### Social

| Feature | Description | Driven by |
|---|---|---|
| Friends system | Send, accept, decline, cancel and remove; canonical-pair storage so a friendship is one row | mausperg |
| Online presence | Live online/offline status for friends, pushed over the WebSocket namespace | lseeger |
| 1:1 chat | Real-time messaging, persisted history with cursor pagination, unread counts, read receipts | lseeger, mausperg |
| Profiles | Public profile pages with avatar, username and friendship state | phofmann, cwolf |
| Notifications | Persisted rows for friend and watchlist events, delivered live and readable later; read/unread, mark-all, delete | lseeger |
| Shared watchlists | Create, rename, delete; add/remove movies; add members as editor or viewer | mausperg, cwolf |

### Platform & Infrastructure

| Feature | Description | Driven by |
|---|---|---|
| File uploads | Avatar upload validated by **magic bytes** rather than the declared MIME type, size-capped, stored in MinIO, served through an authorised `/files/:id` route | mausperg, lseeger |
| Single-origin HTTPS | Caddy terminates TLS; no other web port is published, so no plain-HTTP path exists | lseeger |
| API documentation | Swagger UI generated from the code at `/api/docs` | mausperg, lseeger |
| Unified response shape | One envelope for every endpoint plus global exception filters, so the frontend has a single error path | mausperg |
| Data retention | Scheduled sweeps for read notifications, old messages, orphaned uploads and spent reset tokens | lseeger |
| Legal pages | Privacy Policy and Terms of Service, written for what this app actually does with data | cwolf |
| CI & code quality | GitHub Actions gate, Prettier, ESLint, oxlint, `vue-tsc`/`tsc`, Jest + Vitest, Husky pre-commit hook running in Docker | lseeger |

---

## Modules

**Total: 15 points — 5 Major (2 pts each) + 5 Minor (1 pt each).**

The subject requires 14. The fifteenth point is deliberate: it is the buffer the subject recommends keeping, so that a module not being validated during evaluation does not drop us below the minimum.

| # | Module | Category | Type | Pts |
|---|---|---|---|---|
| 1 | Use a framework for both the frontend and backend | Web | Major | 2 |
| 2 | Real-time features using WebSockets | Web | Major | 2 |
| 3 | Allow users to interact with other users (chat, profile, friends) | Web | Major | 2 |
| 4 | Standard user management and authentication | User Management | Major | 2 |
| 5 | Recommendation system using machine learning | Artificial Intelligence | Major | 2 |
| 6 | Use an ORM for the database | Web | Minor | 1 |
| 7 | Advanced search with filters, sorting and pagination | Web | Minor | 1 |
| 8 | File upload and management system | Web | Minor | 1 |
| 9 | Remote authentication with OAuth 2.0 | User Management | Minor | 1 |
| 10 | Complete 2FA (Two-Factor Authentication) system | User Management | Minor | 1 |
| | | | **Total** | **15** |

### 1. Framework for both frontend and backend — Major (2 pts)

**Why.** The mandatory part demands a frontend, a backend and a database; picking real frameworks for both is what makes the rest of the modules affordable rather than a pile of bespoke plumbing.

**How.** The frontend is **Vue 3** with Vite, Vue Router, Pinia and TypeScript. The backend is **NestJS** with TypeScript — its module/provider structure maps cleanly onto our domains (`auth`, `chat`, `friends`, `movies`, `watchlists`, `notifications`, `files`, `tmdb`, `recommender`), and its Swagger, validation, throttling and WebSocket integrations are first-party rather than glued on.

**Who.** mausperg set up and owns the NestJS backend; phofmann and cwolf own the Vue frontend; lseeger works across both.

### 2. Real-time features using WebSockets — Major (2 pts)

**Why.** Presence, chat and notifications are all worthless if they need a refresh. One socket serves all three.

**How.** A single **socket.io** gateway on a `notify` namespace, authenticated from the same cookie as the REST API. It carries chat messages, read receipts, friend online/offline transitions and notification events. Connections are authenticated on handshake, expired sessions get an explicit `session_expired` event rather than a silent drop, and broadcasts go to per-user rooms so no client receives traffic it should not see. The frontend keeps one shared connection in a Pinia store and re-subscribes on reconnect.

**Who.** lseeger built the gateway, the presence model and the frontend socket layer; mausperg contributed the chat persistence layer.

### 3. Allow users to interact with other users — Major (2 pts)

**Why.** The product only works if the decision is social — a solo swipe feed is a worse Netflix.

**How.** All three required pieces are implemented: **chat** (real-time 1:1 with persisted, paginated history, unread counts and read receipts), **profiles** (public profile pages with avatar and friendship state), and **friends** (request, accept, decline, cancel, remove, with the full list and live online status).

**Who.** mausperg (friends, chat persistence), lseeger (chat real-time layer and frontend), phofmann and cwolf (profile and friends UI).

### 4. Standard user management and authentication — Major (2 pts)

**Why.** Every other feature hangs off identity — ratings, friendships, watchlist roles and file ownership all key on a user.

**How.** Users register and log in with email and password (argon2id, salted), can update their profile, upload an avatar (with a default when none is set), add friends and see their online status, and have a profile page displaying their information. Sessions are JWT access/refresh pairs in `httpOnly` cookies with rotation and replay detection.

**Who.** mausperg, with lseeger on sessions, hardening and tests.

### 5. Recommendation system using machine learning — Major (2 pts)

**Why.** It is the product. Without it the feed is a shuffled list and the swipes mean nothing.

**How.** A separate **Python/FastAPI** service that reads ratings, movies and users directly from Postgres and owns exactly one column, `users.feature_vector`. It combines:

- **Collaborative filtering** over the user–movie reaction matrix, for "people who liked what you liked",
- **Content-based scoring** against the user's feature vector built from genres, cast and crew, which is what carries a brand-new user before there is any collaborative signal,
- **Engagement weighting** from watch time, so a three-second skip and a full-trailer dislike are not treated the same,
- a **diversifier** that spreads the final slate so the feed does not collapse onto one genre.

Recommendations improve continuously: every swipe posts a `/signal`, and `/retrain` refreshes the model.

**Who.** lkubler designed and implemented the engine and its TMDB candidate bridge; lseeger connected it to the application.

### 6. Use an ORM for the database — Minor (1 pt)

**Why.** Hand-written SQL across five developers and a schema that moved every week is how you get drift between what the code assumes and what the database holds.

**How.** **Prisma** over PostgreSQL. The schema is the single source of truth, migrations are versioned in the repository and applied automatically on container start, and the generated client gives compile-time type safety on every query. Composite keys, cascade rules and the indexes behind the chat and notification queries are all declared in `backend/prisma/schema.prisma`.

**Who.** mausperg, with the schema evolving through team review.

### 7. Advanced search with filters, sorting and pagination — Minor (1 pt)

**Why.** A catalogue of hundreds of thousands of titles needs a way in that is not the recommendation feed.

**How.** The Discover view combines **filters** (genre, year range), **sorting** (multiple fields plus direction) and **pagination**, backed by TMDB's discover endpoint with our quality thresholds enforced server-side so the client cannot ask for junk. Selected filters are visible and individually removable, and the feed reloads as they change. A separate user search powers finding people to befriend.

**Who.** lseeger.

### 8. File upload and management system — Minor (1 pt)

**Why.** Avatars are the smallest honest version of this module and the one the product actually needs.

**How.** Uploads are validated on the client and again on the server, where the canonical MIME type is derived from the **magic bytes** rather than trusted from the request, with size and format caps. Files are stored in **MinIO** (S3-compatible) in a private bucket that is not reachable from the host; the browser only ever sees `GET /files/:id`, which checks ownership and access before streaming. Every upload is a first-class database row, so deletion, access control and orphan cleanup all have something to hang off — and because file ids are immutable, replacing an avatar inserts a new row, which makes the served file safe to cache forever. Users can delete their uploads, and a scheduled sweep removes orphans.

**Who.** mausperg and lseeger.

### 9. Remote authentication with OAuth 2.0 — Minor (1 pt)

**Why.** Fewer passwords to hash is fewer passwords to leak.

**How.** **Google OAuth 2.0** via Passport, using the server-side authorization-code flow — the exchange never touches the browser. Google's `sub` claim is stored `unique`, so two accounts can never claim one Google identity, and accounts created this way have no local password, which every read path handles explicitly before reaching argon2. The whole feature is behind a flag: with no credentials configured the button is hidden and the rest of the app is unaffected.

**Who.** mausperg.

### 10. Complete 2FA (TOTP) — Minor (1 pt)

**Why.** It is the one control that makes a stolen password insufficient.

**How.** Standard **TOTP** (RFC 6238) with QR-code enrolment for any authenticator app. The secret is encrypted at rest and never sent to the client in plaintext after enrolment. Activation requires proving a valid code first, so nobody can lock themselves out, and the highest spent counter is stored — a code is only accepted *above* it, so a captured code cannot be replayed for the remainder of its window. Login, and password reset, both require the OTP once 2FA is active; it can be disabled from the profile.

**Who.** lseeger.

> **Not claimed.** The notification system, while implemented and in daily use, covers friend and watchlist events rather than every create/update/delete action in the app, so we do not claim the "complete notification system" minor module for it. It is listed above as a feature, not as a module. The same applies to the log-management, monitoring and status-page DevOps modules: we scoped them out and there is no code for them in this repository.

---

## Technical Stack

### Frontend

| Technology | Role |
|---|---|
| **Vue 3** (Composition API) + **TypeScript** | UI framework |
| **Vite** | Dev server and build tool |
| **Vue Router** | Client-side routing with auth/onboarding navigation guards |
| **Pinia** | State management (auth, feed, chat, friends, notifications, socket) |
| **Tailwind CSS 4** | Styling, OKLCH-based color system |
| **Reka UI** + shadcn-vue pattern | Headless, accessible component primitives, styled by us |
| **vee-validate + Zod** | Form validation, sharing schemas with the backend contract |
| **socket.io-client** | Real-time transport |
| **Lucide** | Icon set |
| **YouTube IFrame API** | Trailer playback on the `youtube-nocookie` host |

**Why Vue.** Nobody on the team had shipped a large frontend before. Vue's single-file components keep template, logic and style in one readable file, its documentation is unusually good for people learning as they go, and Pinia and Vue Router are official rather than a choice between four competing community options. Tailwind was chosen so five people writing CSS in parallel could not produce five stylesheets.

### Backend

| Technology | Role |
|---|---|
| **NestJS** + **TypeScript** | Application framework |
| **Prisma** | ORM and migrations |
| **PostgreSQL 16** | Primary database |
| **Passport** (`passport-jwt`, `passport-google-oauth20`) | Authentication strategies |
| **argon2** | Password hashing |
| **otpauth** + **qrcode** | TOTP two-factor authentication |
| **socket.io** via `@nestjs/websockets` | Real-time gateway |
| **Redis 7** | TMDB response cache and rate-limit accounting |
| **MinIO** | S3-compatible object storage for uploads |
| **Nodemailer** + **Mailpit** | Transactional mail, captured locally in development |
| **class-validator / class-transformer** | Request DTO validation |
| **@nestjs/throttler** | Rate limiting |
| **@nestjs/swagger** | API documentation |

**Why NestJS.** Its module boundaries force a structure on a codebase five people are editing at once, and dependency injection is what made the backend testable — every service in `*.spec.ts` is tested against mocked collaborators rather than a live database. Validation, throttling, Swagger and WebSockets are first-party, so those decisions did not each become their own debate.

**Why PostgreSQL.** The data is unapologetically relational: friendships, watchlist membership with roles, and per-user-per-movie ratings are all many-to-many with attributes on the edge. Postgres also gives us native array columns (`Float[]` for the recommendation feature vector, `Int[]` for onboarding preferences), enum types that the ORM mirrors into TypeScript unions, real check constraints, and partial/composite indexes — the chat history query is one index-only range scan because of them. And it is the same engine the Python recommender reads from directly, so there is exactly one copy of the truth.

### Machine Learning Service

| Technology | Role |
|---|---|
| **Python 3.11** + **FastAPI** | Recommendation service |
| **NumPy / SciPy / scikit-learn** | Collaborative filtering and vector operations |
| **Uvicorn** | ASGI server |

**Why a separate service.** The ML work is Python's home turf, and keeping it out of the Node process meant the algorithm team could iterate on their own schedule against a documented HTTP contract (`/feed`, `/signal`, `/retrain`, `/health`) instead of merging into a TypeScript codebase every day.

### Infrastructure

| Technology | Role |
|---|---|
| **Docker** + **docker compose** | One-command deployment of all nine services |
| **Caddy** | Reverse proxy, automatic TLS, single public origin |
| **GitHub Actions** | CI: format, lint, type-check and tests on every pull request |
| **Husky + lint-staged** | Pre-commit formatting, run inside Docker |
| **pgAdmin** | Database inspection during development |
| **Prometheus** | Scrapes and stores every metric below, 15-day retention |
| **Grafana** | Dashboards, behind Caddy at `/grafana` with no published port |
| **postgres_exporter / redis_exporter** | Translate Postgres and Redis statistics into metrics |
| **cAdvisor / node_exporter** | Per-container resources, and the host's CPU, memory and disk |
| **Caddy & MinIO metrics** | Both speak Prometheus natively; switched on, no exporter needed |
| **prometheus-fastapi-instrumentator** | Instruments the recommendation service in its own code |
| **Alertmanager** | Groups, deduplicates and delivers firing alerts as mail to Mailpit |

**Why Caddy.** It generates its own certificate and terminates TLS with no configuration, which is what lets `https://` work on a fresh clone with no CA setup. Serving the frontend, the API and the WebSocket through one origin also removes an entire class of CORS and cookie problems, and lets the session cookies stay `sameSite: strict`.

**Alerting.** 28 rules in `prometheus/rules/`, split by subject the same way the
dashboards are. Prometheus evaluates them and decides what is firing; it never
notifies anyone itself — that is Alertmanager's job, and it groups related alerts
into one message, suppresses consequences of a cause that is already firing, and
delivers to Mailpit, where the mail can be read at `http://localhost:8025`.

Every rule carries a `for` window so a single missed scrape cannot page anyone,
and the rules have unit tests: `npm run metrics:test` feeds synthetic time series
through a real PromQL evaluation and asserts which alerts fire, and when. That
proves a rule works without waiting for the disk to actually fill.

```bash
npm run metrics:targets   # what is being scraped, and is it healthy
npm run metrics:alerts    # what is firing, pending, or quiet
npm run metrics:test      # unit-test the alert rules
npm run metrics:reload    # apply an edited config without a restart
npm run metrics:drill     # break something on purpose and watch an alert fire
```

`metrics:drill` is the one that proves the chain end to end. It stops a service,
waits for the alert to walk inactive → pending → firing, finds the mail that
names that alert, prints it, and puts the service back — including when it fails
or is interrupted. `redis` is the default because the application is built to
survive it; `target` stops an exporter instead, which removes an observer rather
than a dependency. `recommender` and `postgres` are also available.

**Why the monitoring stack is unreachable from the host.** Prometheus has no
authentication of any kind and everything it holds — the route table, traffic
volumes, login-failure rates — is a map of the system, so it publishes no port;
the same goes for every exporter. Grafana is the single way in, and it is
reachable only through Caddy over TLS with a password from `.env`. The backend's
own `/metrics` is closed twice over: Caddy answers 404 for `/api/metrics`, and
the route itself requires a bearer token, which is what stops the other services
on the Docker network from reading it by name.

**Why one origin, and nothing else published.** Only Caddy's ports reach the host. The frontend, backend and recommender ports are deliberately unpublished — if they were reachable, the plain-HTTP path would still exist. The recommender is unpublished for a stronger reason: it holds full database credentials and has no authentication of its own, so being unreachable from the host is what protects it.

---

## Database Schema

PostgreSQL 16, managed by Prisma. Twelve tables and six enums; the authoritative definition is [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

```mermaid
erDiagram
    users ||--o{ sessions : "has"
    users ||--o{ password_resets : "requests"
    users ||--o{ files : "owns"
    users ||--o| files : "avatar"
    users ||--o{ friends : "userA / userB"
    users ||--o{ messages : "sends"
    users ||--o{ notifications : "receives"
    users ||--o{ ratings : "reacts"
    users ||--o{ watchlist_users : "member of"
    movies ||--o{ ratings : "rated in"
    movies ||--o{ watchlist_movies : "listed in"
    watchlists ||--o{ watchlist_users : "has members"
    watchlists ||--o{ watchlist_movies : "contains"

    users {
        int id PK
        varchar(32) username UK
        varchar(255) email UK
        varchar(512) password "nullable - OAuth accounts have none"
        varchar(255) google_id UK "nullable"
        int avatar_file_id FK "nullable"
        varchar(512) totp_secret "nullable, encrypted"
        boolean totp_active
        int totp_last_counter "replay guard"
        enum role "admin | user"
        boolean onboarding_completed
        float_array feature_vector "owned by the recommender"
        int_array genre_ids "onboarding preferences"
        timestamp created_at
    }
    sessions {
        int id PK
        int user_id FK
        varchar(512) session_hash
        varchar(512) previous_hash "rotation grace window"
        timestamp rotated_at
        varchar(128) ip_address
        timestamp expires_at
    }
    password_resets {
        int id PK
        int user_id FK
        varchar(64) token_hash UK "SHA-256, indexed lookup"
        timestamp expires_at
        timestamp used_at "single-use marker"
    }
    files {
        int id PK
        int owner_id FK
        varchar(255) key UK "MinIO object key"
        varchar(64) mimetype "from magic bytes"
        int size
        enum kind "avatar"
    }
    friends {
        int user_a_id PK_FK "canonical pair, a < b"
        int user_b_id PK_FK
        int initiator_id FK
        enum status "pending | accepted"
    }
    messages {
        int id PK
        int user_a_id FK "canonical pair"
        int user_b_id FK
        int sender_id FK
        varchar(2000) body
        timestamp read_at "nullable"
        timestamp created_at
    }
    notifications {
        int id PK
        int user_id FK "recipient"
        enum type "10 event types"
        int actor_id FK "SetNull on delete"
        int entity_id
        json params "snapshotted at event time"
        timestamp read_at "nullable"
    }
    movies {
        int id PK
        int tmdb_id UK
        varchar(255) name
        varchar(255) poster_path
    }
    ratings {
        int user_id PK_FK
        int movie_id PK_FK
        enum trailer_rating "like | dislike"
        smallint watch_time "seconds"
        timestamp created_at
    }
    watchlists {
        int id PK
        varchar(255) name
        timestamp created_at
    }
    watchlist_users {
        int watchlist_id PK_FK
        int user_id PK_FK
        enum role "editor | viewer"
    }
    watchlist_movies {
        int watchlist_id PK_FK
        int movie_id PK_FK
    }
```

### Design decisions worth knowing

**Canonical pairs.** `friends` and `messages` both key on a sorted `(user_a_id, user_b_id)` pair rather than on sender/recipient. Expressed as sender/recipient, fetching a conversation is `(sender=A AND recipient=B) OR (sender=B AND recipient=A)` — an OR across two columns that no single index can serve. Sorting the ids makes a conversation one equality prefix, so a single index answers both "latest page" and "page before this cursor" as one range scan with no sort step. The same idiom means a friendship is one row, not two that can disagree.

**Notifications are rows, not events.** The socket push is the fast path; the row is the source of truth, so a user who was offline loses nothing. Values are snapshotted into `params` at event time, so a later username change cannot rewrite history, and `actor_id` is `SetNull` rather than `Cascade` — "alice accepted your request" has to survive alice deleting her account.

**Files are rows, not URL strings.** Modelling an upload as a first-class row is what gives access control, deletion and orphan cleanup something to hang off. Ids are immutable, so replacing an avatar inserts a new row instead of rewriting one — which is what makes `/files/:id` safe to cache forever.

**Hash choice is per-purpose.** Sessions use argon2, because the refresh JWT carries its `sessionId` and the lookup is direct. Password-reset tokens use SHA-256, because the link carries only the token: an argon2 hash is salted, so `WHERE token_hash = ?` could not find the row, and the alternative — scanning every outstanding row and verifying each — is O(rows) argon2 calls on an unauthenticated endpoint, which is a free denial-of-service. A slow KDF protects low-entropy secrets; these are 32 bytes from `randomBytes`.

**Retention is explicit.** Read notifications, old messages, orphaned uploads and spent reset tokens are swept on a schedule with windows declared in one file, `backend/src/retention.config.ts`.

---

## Team Information

Five members, so roles are specialised rather than doubled up.

| Member | Role(s) | Responsibilities |
|---|---|---|
| **cwolf** | **Product Owner**, Frontend Developer | Owns the product vision and feature priorities; decides what "done" means and validates completed work. Built frontend features and improvements, and owned the research-heavy non-code deliverables — Terms of Service, Privacy Policy and the legal/compliance content. |
| **mausperg** | **Technical Lead / Architect**, Backend Developer | Owns the backend architecture and the cross-cutting technical decisions: the unified API response shape, error-handling strategy, endpoint design conventions and the database schema. Reviews critical backend changes. Implemented most of the backend endpoints. |
| **lseeger** | **Project Manager**, Full-stack Developer, QA | Organises the team: meeting scheduling, issue triage, tracking progress and unblocking. Full-stack feature work plus the testing and infrastructure side — CI pipeline, pre-commit tooling, parts of the Docker setup, and the test suites. |
| **phofmann** | Frontend Developer | Owns how the application looks and feels. Built the bulk of the frontend design and the component styling, and drove responsive behaviour across screen sizes. |
| **lkubler** | Developer — Machine Learning | Owns the recommendation engine end to end: collaborative filtering, content-based scoring, engagement weighting, diversification, and the TMDB candidate bridge that feeds it. |

All five members contributed code to `main` throughout the project.

---

## Project Management

### How the work was organised

The project opened with **full-team meetings**: what we wanted to build, what the product actually was, and the major scope and architecture decisions — frameworks, database, module selection. Getting those settled with everyone in the room was deliberate, because they are the decisions that are expensive to reverse later.

After that, the cadence changed to **smaller, targeted meetings** with only the members relevant to a given feature, issue or design decision. A frontend layout problem does not need the ML developer in the room, and a discussion about the recommender's HTTP contract only needs the two people on either side of it. This kept meeting overhead low once the direction was set.

Work was broken down into issues, assigned to individuals, and tracked on a board so that at any point it was visible who was working on what.

### Tools

| Purpose | Tool |
|---|---|
| Issue tracking & work breakdown | **GitHub Issues** |
| Board / who-does-what | **GitHub Projects** |
| Code review & integration | **GitHub Pull Requests** |
| Automated quality gate | **GitHub Actions** |
| Communication | **In person at 42 Heilbronn**, plus GitHub Issues and Projects for everything asynchronous |

Being on campus together meant most coordination happened face to face; GitHub carried the parts that needed to persist — decisions, task state, and review discussion attached to the code it was about.

### Branch protection and review

`main` is **protected**. Nothing lands on it directly:

1. Work happens on a feature branch.
2. A pull request opens against `main`.
3. CI must pass — Prettier format check, ESLint/oxlint, TypeScript type-check, and the unit test suites for both frontend and backend.
4. A `CODEOWNERS` file routes reviews automatically: frontend changes to the frontend owner, backend and tooling changes to their owner.
5. Only then can it be merged.

A **Husky pre-commit hook** runs lint-staged before a commit is even created — inside a Docker container, so it behaves identically regardless of the developer's local Node version. Commit messages follow a **Conventional Commits**–style convention (`feat:`, `fix:`, `docs:`, `refactor:`, `tests:`, optionally scoped), which is what makes the history readable as a changelog. See [`_meta/03-git-commit-convention.md`](_meta/03-git-commit-convention.md).

---

## Individual Contributions

### cwolf — Product Owner, Frontend Developer

Owned the product direction: what CineMates is, which features mattered, and in what order. On the code side, built frontend features and a long tail of improvements across the app — profile and watchlist UI, movie detail presentation, and general polish.

Also owned the deliverables that are research rather than programming, and are easy to underestimate: the **Privacy Policy** and **Terms of Service**. These are a hard requirement of the subject and cannot be boilerplate — they have to describe what *this* application does with user data, including TMDB requests, third-party embedded video, cookie use for sessions, and what account deletion actually removes. That meant reading how the data actually flows through the system before writing a word of it.

### mausperg — Technical Lead, Backend Developer

Designed and built the majority of the backend. Beyond individual endpoints, owned the decisions that every endpoint has to obey: the **unified response envelope**, the **error-handling strategy** and global exception filters, endpoint naming and versioning conventions, and the **database schema**.

Implemented authentication end to end — registration, login, argon2 hashing, JWT access/refresh sessions in `httpOnly` cookies, password reset by single-use token, and Google OAuth 2.0 — plus the friends system, watchlists with role-based membership, and the file upload and storage layer.

**Challenge — introducing the unified response shape mid-project.** The standard envelope arrived after a substantial number of endpoints already existed in their original shape. Introducing it meant a period where some endpoints had migrated and others had not, the frontend was written against both, and features broke in ways whose cause was the mismatch rather than the feature. The fix was to treat it as a migration rather than a refactor: convert the backend endpoint by endpoint, keep the shared TypeScript types in `shared/` as the contract both sides compile against, and let the type-checker find the frontend call sites that had not been updated. Painful in the middle, but it left one error path in the frontend instead of one per endpoint.

### lseeger — Project Manager, Full-stack Developer, QA

Organised the team's process and worked across the whole stack.

**Features:** the complete **chat system**, backend and frontend — WebSocket gateway, message persistence with cursor-paginated history, unread counts, read receipts and the chat UI. The **notification system**, from the database rows through delivery to the notification centre. The **advanced search and Discover** experience — filters, sorting, pagination, and the TMDB discover endpoint behind them, with quality thresholds enforced server-side. **TOTP two-factor authentication**, including the replay guard. The movie detail endpoint and view.

**Infrastructure:** parts of the Docker Compose setup, the Caddy single-origin HTTPS configuration, the GitHub Actions CI pipeline, the Husky/lint-staged pre-commit tooling running in Docker, and the data-retention sweeps. Also **connected the recommendation engine to the application** — the integration between the NestJS backend and lkubler's FastAPI service.

**Testing:** built out the backend unit test suites, particularly around auth, sessions, TOTP and the socket gateway, and the end-to-end suite.

**Challenge — a three-week exam period.** Common Core exams took lseeger and lkubler away from the project for roughly three weeks. The project could not simply pause, so the mitigation was front-loading: making sure the infrastructure and CI were stable enough to be self-service before leaving, and that in-flight work was either merged or documented in an issue rather than living in someone's head. Coming back meant a deliberate catch-up pass — reading the diff of what had landed, re-running the full check suite, and re-reading the areas that had moved before touching them.

**Challenge — frontend responsiveness.** Getting the interface to behave from a phone screen up to a wide desktop turned out to be the least predictable part of the work. The chat view in particular looked correct on the development screen and then fell apart on larger displays, for reasons that were not visible in the component being edited — layout constraints inherited from ancestors, and flex containers that behave differently once there is surplus space rather than a shortage. The lesson was to stop debugging at the component and test at the breakpoints instead, and to build the layout mobile-first so that extra space is something the layout *opts into* rather than something it has to survive.

### phofmann — Frontend Developer

Built most of what the application looks like: the visual design, the component styling on top of the Reka UI primitives, the Tailwind design tokens, and the layout of the main views — feed, profile, friends, onboarding. Drove the responsive behaviour across breakpoints and the general interaction feel of the app, including the swipe mechanic that the whole product rests on.

### lkubler — Machine Learning Developer

Designed and implemented the recommendation engine as a standalone Python/FastAPI service, and connected it to TMDB for candidate retrieval.

The engine is genuinely hybrid rather than a single technique: **collaborative filtering** over the user–movie reaction matrix, **content-based scoring** against a per-user feature vector built from genres, cast and crew, **engagement weighting** derived from watch time so that a three-second skip and a full-trailer dislike are weighted differently, and a **diversifier** so the returned slate does not collapse into one genre. Also owned the persistence layer that lets a user's learned profile survive a restart, and documented the whole HTTP contract (`recommender/recommendation/INTEGRATION.md`) so the backend could be built against it in parallel.

**Challenge — the cold-start problem.** Collaborative filtering has nothing to work with for a user with zero ratings, and CineMates users start with exactly zero. This is why onboarding asks for favourite genres and why the content-based path exists at all: it carries a new user until enough swipes accumulate for the collaborative signal to mean anything.

**Challenge — the same three-week exam period** as lseeger, with the added difficulty that the recommender is the component fewest other people could pick up in the meantime.

### Shared challenges

**HTTPS and Google OAuth without a stable domain.** The subject requires HTTPS everywhere. Caddy's internal CA solves the certificate, at the cost of one browser warning per device. Google OAuth was the harder half: the redirect URI must be registered character-for-character in the Google Cloud Console, and Google refuses private IP addresses as authorised redirect URIs. Without a public domain, this means Google sign-in works on `localhost` and cannot work from another device on the LAN. Rather than leave a button that silently fails, we put the whole feature behind `GOOGLE_ENABLED` so a LAN demo hides it and the email/password path — which is the mandatory one — is unaffected.

**Rootless Docker on the school machines.** Rootless Docker refuses to publish ports below 1024, so the conventional `:443` makes the entire stack fail to start. Everything is served on `:8443` instead, which needs no host configuration and behaves identically.

---

## Instructions

### Prerequisites

| Requirement | Notes |
|---|---|
| **Docker Engine** with **Compose v2** | The only hard requirement. Everything runs in containers. |
| **Git** | To clone the repository. |
| **A TMDB API key** (Bearer token) | Free from [themoviedb.org](https://www.themoviedb.org/settings/api). Without it there are no real movies — the recommender falls back to a small stub pool. |
| **Node.js** ≥ 20.19 or ≥ 22.12 | *Optional*, and only so your editor gets IntelliSense. The app, tests and linters all run inside Docker, so your host Node version does not matter. |
| **openssl** | Optional, to generate a fresh `MFA_KEY`. |
| A modern **Google Chrome** | The target browser for evaluation. |

### Step 1 — Create the config file

```bash
cp .env.example .env
```

Then edit `.env`:

- Set real values for `DB_PASSWORD`, `MINIO_SECRET_KEY` and `PGADMIN_PASSWORD` if you care (the defaults work for a local run).
- **Set `TMDB_API_KEY`** to your TMDB Bearer token.
- Optionally generate fresh secrets:

  ```bash
  openssl rand -hex 32   # for MFA_KEY and RETRAIN_SECRET
  openssl rand -hex 64   # for JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
  ```

- The `GOOGLE_*` keys can stay empty — see [Google Sign-In](#google-sign-in-optional). With `GOOGLE_ENABLED=false` the button is simply hidden and everything else works.

`.env` is git-ignored; `.env.example` documents every variable.

### Step 2 — Install local dependencies *(first time only, optional)*

```bash
npm run setup
```

This installs Husky and wires up the pre-commit hook, and installs `node_modules` locally in `frontend/` and `backend/` so your IDE has full type information.

> **Engine warnings are expected** if your local Node is older than 20.19.0 — the install still completes. The local `node_modules` are **for the IDE only**; the app always runs inside Docker from isolated named volumes. Never use them to run the app or the tests.
>
> The pre-commit hook runs lint-staged inside a `node:22` container, so **Docker must be running when you commit**. The first use pulls the image (~1.1 GB, cached afterwards). If Docker is not running the hook skips with a warning and CI catches it instead.

### Step 3 — Start the stack

```bash
docker compose up --build
```

That is the whole deployment. Database migrations are applied automatically on backend start (`prisma migrate deploy`), so there is no separate setup step. On later runs `--build` can be omitted.

First boot takes a few minutes: the Python service installs NumPy, SciPy and scikit-learn before it comes up. The recommender is reported unhealthy until it finishes — this is expected.

| Service | URL |
|---|---|
| **App** | https://localhost:8443 |
| Backend API | https://localhost:8443/api |
| **API docs (Swagger)** | https://localhost:8443/api/docs |
| **Grafana** (metrics dashboards) | https://localhost:8443/grafana |
| Mailpit (all outgoing mail) | http://localhost:8025 |
| pgAdmin | http://localhost:5050 |
| MinIO console | http://localhost:9001 |
| PostgreSQL | localhost:5432 |

`http://localhost:8080` redirects to HTTPS.

Grafana signs in with `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` from `.env`.
It has no published port of its own — that route through Caddy is the only way
in, which is also why it is the one admin tool here that is not plain HTTP on a
host port. Prometheus, which it reads, is not reachable from the host at all;
`npm run metrics:targets` reports what it is scraping.

> **Expect one certificate warning.** The app is served over HTTPS with a certificate Caddy generates itself, so the first visit to `https://localhost:8443` shows *"your connection is not private"*. Accept it once — this is expected, not a defect. A real CA would need either a public domain or a certificate installed into the machine's trust store, neither of which belongs in a project you clone and run.
>
> **Why `:8443` and not `:443`?** The school machines run rootless Docker, which refuses to publish privileged ports — on `443` the stack does not start at all. `8443` needs no host configuration and behaves identically.

### Step 4 — Use the app

Open **https://localhost:8443**, accept the certificate, and register an account. Onboarding asks for a few favourite genres to seed your recommendations, and then you are in the trailer feed.

To exercise the multi-user features — chat, presence, friend requests, shared watchlists — register a second account in a private window and befriend the first.

### Demo data

Both need the stack running (`docker compose up -d`).

```bash
npm run seed      # 5 accounts, onboarded, all friends, 30 trailer reactions
npm run retrain   # refits the recommendation model
```

Log in at **https://localhost:8443** with the email, not the username:

| Email                                     | Password     |
| ----------------------------------------- | ------------ |
| `seed1@example.com` … `seed5@example.com` | `B8skxi!dk&` |

`seed` paces itself against the auth rate limit, so it takes a couple of minutes. Both are safe to re-run.

`retrain` needs `RETRAIN_SECRET` in `.env`; after changing it, `docker compose up -d recommender`. It reports `skipped` below 20 interactions / 3 users / 3 movies, which `npm run seed` clears.

### Opening the app from another device

`localhost` is not a name for this server — it means *the machine currently asking*, so on a phone it resolves to the phone. Two variables in `.env` teach the stack a second name. Both **add** a name rather than replacing one, so `https://localhost:8443` keeps working on the host at the same time.

1. **`APP_HOST`** — the additional host Caddy and Vite answer to. Find this machine's LAN address:

   ```bash
   ip -4 route get 1.1.1.1 | awk '{print $7; exit}'    # Linux
   ipconfig getifaddr en0                              # macOS
   ```

   Do not leave it blank: an empty value turns the site into a catch-all that serves every `Host`.

2. **`APP_ORIGINS`** — the origins the backend accepts. **Add `https://<that address>:8443` here too**, or the WebSocket handshake is refused and chat, presence and live notifications go dead on that device while everything else looks healthy. Nothing in the UI tells you this is what happened.

Then restart so all three services re-read them:

```bash
docker compose down && docker compose up
```

Two things stay broken on a LAN address, by design:

- **Google sign-in will not work** — Google refuses private IP addresses as authorised redirect URIs. Set `GOOGLE_ENABLED=false` for a LAN demo so the button is hidden rather than broken. Email/password login is unaffected.
- **The certificate warning must be accepted once per device.** `tls internal` is an untrusted CA by construction.

Password-reset links point at the first entry in `APP_ORIGINS`, i.e. `localhost` — which is where Mailpit is anyway.

### Email (Mailpit)

**No mail ever leaves the machine, deliberately.** The stack runs [Mailpit](https://github.com/axllent/mailpit), which accepts everything the backend sends over SMTP and displays it in a web UI instead of delivering it.

Anything the app mails — currently password-reset links — appears at **http://localhost:8025** within a second. Open it, click the link, continue in the app.

This needs no account, no credentials and no outbound network, so password recovery works on a clean clone and offline. Real delivery would need a provider account nobody cloning this repo has, and unverified senders get rate-limited or silently dropped — which fails during a demo rather than during development. Switching to real delivery is `SMTP_HOST`, `SMTP_PORT` and `MAIL_FROM` in `.env`, with no code change.

> **If a reset mail seems not to arrive, look in Mailpit, not your inbox.** It was never sent anywhere else.

### Google Sign-In (optional)

**The app runs fine without this.** Leave the Google keys empty and everything else works exactly as documented — the "Continue with Google" button is simply hidden. A missing button is the expected state, not a failure.

The credentials cannot be committed to a repository, so each person who wants to exercise it creates their own. It takes about five minutes, all of it in the Google Cloud Console — **nothing in this repository needs changing.**

**Sign in with a personal Google account.** A school or work account may have project creation disabled, or force every project to be organisation-internal, which surfaces much later as `org_internal` or `admin_policy_enforced` at the consent screen.

<details>
<summary><b>Full walkthrough (click to expand)</b></summary>

**1. Create a project** → https://console.cloud.google.com/projectcreate

Only **Project name** is required; leave location on "No organization". Decline the billing prompt if it appears — none of this costs anything. Creation does not always switch the active project for you: check the project picker in the top bar before continuing, because every page below is scoped to whichever project is selected.

**Do not enable any API.** The profile is read from Google's OIDC `userinfo` endpoint, which is not a gated API.

**2. Configure the consent screen** → https://console.cloud.google.com/auth/overview
*(older layout: APIs & Services → OAuth consent screen)*

- **App name** — anything; this is what the consent screen shows
- **User support email** — your own address
- **Audience: External** — "Internal" is Workspace-only and would lock out every outside account
- Leave publishing status on **Testing**. Do not click *Publish app*: that starts a verification review this does not need.

Ignore the **Data Access** / *Scopes* page entirely. `email` and `profile` are non-sensitive and are requested by the backend at runtime.

**3. Add yourself as a test user** → https://console.cloud.google.com/auth/audience

Under **Test users → Add users**, add every Google account you intend to log in with, then **Save**.

> **Do not skip this.** An account not on the list is refused at Google's own consent screen with *"app has not completed the Google verification process"*. It looks like a bug in this app, but the request never reaches us.

**4. Create the OAuth client** → https://console.cloud.google.com/auth/clients
*(older layout: APIs & Services → Credentials → Create credentials → OAuth client ID)*

- **Application type: Web application**
- **Authorized redirect URIs** → **Add URI**:

  ```
  https://localhost:8443/api/v1/auth/google/callback
  ```

- **Authorized JavaScript origins** → leave **empty**

> **The two fields sit next to each other and only the second one is right.** JavaScript origins are for the browser-side implicit flow; this app does the code exchange on the server, so no browser origin is involved. A URI in the wrong field — or typed but never saved — is what produces `redirect_uri_mismatch`, and the console gives no hint either way.

Click **Save**, then **reload the page and confirm the URI is still listed** — that is the only proof it was stored. Google compares the string character for character, so it must match `GOOGLE_CALLBACK_URL` exactly: `https` not `http`, port `8443`, the `v1` in the path, no trailing slash.

**5. Fill in `.env`**

The client ID and secret appear once, on creation. **Copy the secret now** — it cannot be retrieved later, only regenerated.

```bash
GOOGLE_CLIENT_ID=<ends in .apps.googleusercontent.com>
GOOGLE_CLIENT_SECRET=<starts with GOCSPX->
GOOGLE_CALLBACK_URL=https://localhost:8443/api/v1/auth/google/callback
GOOGLE_ENABLED=true
```

Then restart so both containers pick up the new environment:

```bash
docker compose up -d --force-recreate frontend backend
```

**6. Verify before opening the browser**

```bash
curl -k -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://localhost:8443/api/v1/auth/google
```

A `302` to `accounts.google.com` means the backend is configured; `503` means it is not. This separates a backend problem from a console problem, which the browser error page does not.

To see the exact string being sent — the one Google compares against your console entry:

```bash
curl -k -s -o /dev/null -D - https://localhost:8443/api/v1/auth/google \
  | grep -i '^location:' | tr '&' '\n' | grep redirect_uri
```

Then open `https://localhost:8443` — reaching the app on that exact origin matters, since the session cookies are `sameSite: strict`.

**Troubleshooting**

| What you see | Cause |
|---|---|
| `redirect_uri_mismatch` at Google | Almost always the console side, not `.env`. In order: the URI went into *JavaScript origins* instead of *redirect URIs*; **Save** was never clicked; or it is on a different OAuth client than the one in `.env`. Google's error page has a developer-details expander showing the `redirect_uri` it actually received — diff that against the console. |
| `redirect_uri_mismatch` although the URI is definitely correct | Propagation. Google's redirect-URI changes are not always instant — wait a few minutes and retry in a fresh tab. |
| "Access blocked" / "has not completed verification" | The account signing in is not on the **Test users** list (step 3). |
| No "Continue with Google" button | `GOOGLE_ENABLED` is not `true`, or the frontend container was not restarted. |
| `503` from `/api/v1/auth/google` | The backend has no credentials — one of the three `GOOGLE_*` values is empty, or the backend was not restarted. |
| `invalid_client` at Google | The client secret is wrong, or was regenerated without updating `.env`. |
| Signed in at Google, then bounced back to login | The session cookie did not survive the redirect. Check you reached the app over `https://localhost:8443` and not some other host or port. |

</details>

### Development workflow

**Adding a package.** Always install from inside the running container. This updates `package.json` and the lock file on the host through the bind mount, and installs into the container's named volume:

```bash
docker compose exec frontend sh -c "npm install <package>"
docker compose exec backend  sh -c "npm install <package>"
```

The container keeps running — no restart needed. Then sync your IDE's copy:

```bash
cd frontend && npm install   # or backend/
```

**Changing the database schema.** Edit `backend/prisma/schema.prisma`, then create the migration:

```bash
docker compose exec backend npx prisma migrate dev --name <describe_the_change>
```

Committed migrations are applied automatically on every subsequent container start.

**Full reset** (e.g. after a lock-file merge conflict, or to wipe the database):

```bash
docker compose down -v && docker compose up --build
```

**VS Code.** Open the repo and accept the "Install recommended extensions" prompt — this sets up Prettier (format on save) and ESLint automatically.

### Testing

**Unit tests** — backend (Jest) and frontend (Vitest), no database required:

```bash
npm run test                          # backend suite via Docker, from the repo root
docker compose exec backend npm test  # inside the running container
docker compose exec frontend npm test # frontend component/store tests
```

**End-to-end tests** — these need the database running, and use a separate test database:

```bash
docker compose exec backend npm run test:e2e
```

Test files live at `backend/src/**/*.spec.ts` (unit), `backend/test/**/*.e2e-spec.ts` (e2e) and `frontend/src/**/*.spec.ts`.

### Code quality

Three commands, run from the repo root via Docker, so no local Node version is required:

```bash
npm run fix    # auto-fix formatting and lint issues
npm run check  # read-only validation: format + lint + type-check + tests — identical to CI
npm run test   # backend tests only
```

`npm run check` is what CI runs, so a green local check means a green pull request. The pre-commit hook only covers staged files; `npm run check` covers everything.

There is also `npm run check:console`, a Playwright script that drives the running app — including token expiry, resume, a second tab and a backend restart — and fails if a single `console.error` or `console.warn` appears. A clean browser console is a requirement of the subject and is easy to regress by accident. It needs the stack running and a Chromium available:

```bash
docker compose up -d
npx playwright install chromium
npm run check:console
```

Details of the formatting and linting pipeline: [`_meta/01-formatting-pipeline.md`](_meta/01-formatting-pipeline.md).

---

## Known Limitations

Honest list of what does not work, or works only under conditions.

- **Google sign-in is `localhost`-only.** Google rejects private IP addresses as authorised redirect URIs, so without a public domain the OAuth flow cannot complete from another device on the network. Email/password authentication — the mandatory path — is unaffected. Set `GOOGLE_ENABLED=false` for a LAN demo.
- **The TLS certificate is self-signed**, so every browser shows a warning on first visit and it must be accepted once per device. A trusted certificate needs a public domain or a CA in the machine's trust store.
- **Mail is never delivered.** Everything the app sends is captured by Mailpit and readable at http://localhost:8025. This is deliberate (see above), but it means password reset cannot be demonstrated from a real inbox.
- **Notification coverage is partial.** Notifications exist for friend and watchlist events. They do not yet cover every create/update/delete action in the application, which is why we do not claim the corresponding module.
- **The interface is English only.** There is no internationalisation layer, and no language switcher.
- **A TMDB API key is required for real content.** Without one the recommender serves a small fixed stub pool, which is enough to see the mechanics but not the product.
- **Data is pruned on a schedule.** Read notifications older than 30 days, unread ones older than 90, and chat messages older than 90 days are deleted. This is a privacy decision, but it does mean old chat history disappears.
- **Single-instance only.** The WebSocket gateway keeps presence in process, so the backend does not currently scale horizontally without a Redis socket.io adapter.

---

## Resources

### Documentation

**Frontend**
- [Vue 3 Guide](https://vuejs.org/guide/introduction.html) · [Vue Router](https://router.vuejs.org/) · [Pinia](https://pinia.vuejs.org/)
- [Vite](https://vite.dev/guide/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Reka UI](https://reka-ui.com/) · [shadcn-vue](https://www.shadcn-vue.com/)
- [VeeValidate](https://vee-validate.logaretm.com/v4/) · [Zod](https://zod.dev/)
- [MDN — JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) · [MDN — Web APIs](https://developer.mozilla.org/en-US/docs/Web/API)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)

**Backend**
- [NestJS Documentation](https://docs.nestjs.com/) · [NestJS WebSockets / Gateways](https://docs.nestjs.com/websockets/gateways) · [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [Prisma Documentation](https://www.prisma.io/docs) · [Prisma Schema Reference](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
- [PostgreSQL 16 Manual](https://www.postgresql.org/docs/16/index.html) · [Use The Index, Luke](https://use-the-index-luke.com/) — the indexing reasoning behind the chat and notification queries
- [Socket.IO v4](https://socket.io/docs/v4/)
- [Redis Documentation](https://redis.io/docs/latest/)
- [MinIO Object Storage](https://min.io/docs/minio/linux/index.html) · [AWS SDK for JavaScript v3 — S3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)

**Security & authentication**
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) — particularly [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [RFC 9106 — Argon2](https://datatracker.ietf.org/doc/html/rfc9106)
- [RFC 6238 — TOTP](https://datatracker.ietf.org/doc/html/rfc6238)
- [OAuth 2.0 for Web Server Applications (Google)](https://developers.google.com/identity/protocols/oauth2/web-server)
- [MDN — Set-Cookie / SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)

**Machine learning**
- [Google — Recommendation Systems course](https://developers.google.com/machine-learning/recommendation) — collaborative vs. content-based filtering, matrix factorisation
- [scikit-learn User Guide](https://scikit-learn.org/stable/user_guide.html) · [NumPy](https://numpy.org/doc/stable/) · [SciPy](https://docs.scipy.org/doc/scipy/)
- [FastAPI](https://fastapi.tiangolo.com/)

**Infrastructure & tooling**
- [Docker Documentation](https://docs.docker.com/) · [Docker Compose](https://docs.docker.com/compose/) · [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/)
- [Caddy Documentation](https://caddyserver.com/docs/) · [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https) · [Caddyfile reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [GitHub Actions](https://docs.github.com/en/actions) · [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [Jest](https://jestjs.io/docs/getting-started) · [Vitest](https://vitest.dev/) · [Playwright](https://playwright.dev/docs/intro)

**External APIs**
- [TMDB API Reference](https://developer.themoviedb.org/reference/intro/getting-started) · [TMDB Terms of Use](https://www.themoviedb.org/api-terms-of-use)

### Video tutorials

Channels and series the team used while learning these technologies. (Linked at channel level, since individual videos get re-uploaded and re-titled.)

- [**Vue Mastery**](https://www.youtube.com/@VueMastery) and the [official Vue.js channel](https://www.youtube.com/@Vuejs) — Composition API and Vue 3 fundamentals
- [**The Net Ninja**](https://www.youtube.com/@NetNinja) — the *Vue 3*, *Tailwind CSS* and *Docker* playlists; the most useful long-form series for people starting from zero
- [**Marius Espejo**](https://www.youtube.com/@MariusEspejo) — NestJS in depth: modules, providers, guards, interceptors and testing
- [**TechWorld with Nana**](https://www.youtube.com/@TechWorldwithNana) — Docker and Docker Compose, and the general "why containers" explanation
- [**Traversy Media**](https://www.youtube.com/@TraversyMedia) — full-stack crash courses, useful for seeing a whole stack assembled end to end
- [**Fireship**](https://www.youtube.com/@Fireship) — short conceptual overviews for evaluating a technology quickly before committing to it
- [**Web Dev Simplified**](https://www.youtube.com/@WebDevSimplified) — authentication concepts, JWT vs. sessions, and CSS layout debugging

### How AI Was Used

AI tooling was used throughout the project, always as an assistant to work the team understood and reviewed — never as a substitute for it. Every generated change went through the same pull-request review and CI gate as hand-written code, and each member is able to explain the code in the areas they own.

**Where it was used, and for what:**

**1. Automated testing and CI pipelines.** Generating and expanding the automated quality infrastructure: the GitHub Actions workflow, the ESLint/oxlint and Prettier configuration, the Husky and lint-staged pre-commit setup, and large parts of the **unit and end-to-end test suites** (`backend/src/**/*.spec.ts`, `backend/test/**/*.e2e-spec.ts`, `frontend/src/**/*.spec.ts`). Test scaffolding is repetitive and mechanical — exactly the kind of work worth delegating — while deciding *what* is worth asserting stayed with us. Assertions were reviewed to confirm they actually test behaviour rather than restating the implementation.

**2. Documentation.** Producing and maintaining the written artefacts of the project: this README, the notes under [`_meta/`](_meta/), and the API documentation annotations that generate the Swagger page. AI drafted; the team supplied the facts, the decisions and the reasoning, and corrected the drafts against the actual code. Where the draft claimed something the code did not do, the claim was removed rather than the code changed to match it.

**3. Code audits and bug hunting.** Reviewing our own structure for problems that are easy to miss from the inside — inconsistent error handling, endpoints that had drifted from the unified response shape, missing authorisation checks, unhandled edge cases in the session and TOTP logic, and race conditions around concurrent refresh. Findings were treated as leads to verify, not as verdicts: several were false positives, and those that were real were fixed by hand once we understood them.

**4. Pre-merge review.** Before merging a branch into `main`, using AI to look for unintended side effects — particularly during the mid-project migration to the unified response shape, where a change in one endpoint could silently break a frontend call site nobody was looking at. This complemented human review and CI rather than replacing either.

**5. Implementing changes from a written spec.** For well-understood changes, we wrote a precise specification first — what should change, where, and what the resulting behaviour must be — and used AI to carry out the implementation against it. Writing the spec is where the thinking happens; it also makes the result reviewable, because there is a stated intent to check the diff against. This was used for refactors and mechanical changes with a clear shape, not for designing features.

**Where it was deliberately not used:** the core design decisions — the product concept, the module selection, the database schema, the recommendation engine's algorithmic approach, and the architectural choices recorded in the Technical Stack section above — were made by the team. Those are the decisions we have to defend, and AI tends to produce the most likely answer rather than the one that fits our specific constraints.

---

## Repository Layout

```
.
├── frontend/          Vue 3 + Vite single-page application
│   └── src/
│       ├── api/           Typed HTTP client per domain
│       ├── components/    UI components (ui/ holds the shared primitives)
│       ├── composables/   Reusable composition functions
│       ├── stores/        Pinia stores (auth, feed, chat, friends, notify, …)
│       ├── router/        Routes and navigation guards
│       └── views/         Route-level pages
├── backend/           NestJS API
│   ├── prisma/            Schema and versioned migrations
│   ├── src/               One directory per domain module
│   └── test/              End-to-end test suite
├── recommender/       Python/FastAPI recommendation engine
│   └── recommendation/    Collaborative + content-based scoring, diversifier
├── shared/            TypeScript types and constants shared by frontend & backend
├── caddy/             Caddyfile — TLS termination and routing
├── postgres/          Database init scripts
├── pgadmin/           pgAdmin server definitions
├── scripts/           Utility scripts (seeding, retraining, browser-console check)
├── _meta/             Internal notes: formatting pipeline, database, git convention
├── docker-compose.yml Nine services, one command
└── .env.example       Every environment variable, documented
```

---

## Credits

Movie data, posters and trailer metadata are provided by [**The Movie Database (TMDB)**](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB.

Trailer playback uses the YouTube IFrame Player API on the privacy-enhanced `youtube-nocookie` host.

---

*Built at [42 Heilbronn](https://www.42heilbronn.de/) by cwolf, mausperg, phofmann, lseeger and lkubler.*
