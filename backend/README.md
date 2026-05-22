# TrailerTinder — Backend

NestJS + TypeScript API. Runs on port 3000 inside Docker.

---

## Stack

| | |
|---|---|
| Framework | NestJS 11 |
| Language | TypeScript (strict) |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Test runner | Jest + supertest |

---

## Module structure

```
src/
├── app.module.ts          Root module — imports all feature modules
├── app.controller.ts      HTTP endpoints (see below)
├── app.service.ts         Business logic
├── auth/                  Authentication (register, login, refresh, logout)
├── users/                 User profile management
├── prisma/
│   ├── prisma.module.ts   Global module — exports PrismaService to all modules
│   └── prisma.service.ts  Extends PrismaClient, connects on ModuleInit
└── main.ts                Bootstrap — port from $PORT or 3000, CORS enabled
```

---

## Endpoints

All routes except auth are protected by the global `JwtAccessGuard` (requires valid `access_token` cookie).

### App

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Returns `{ status: "ok" }` |
| `GET` | `/api/ping` | No | Returns `{ message: "pong", db_time }` — verifies DB connectivity |

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | No | Create account, sets JWT cookies |
| `POST` | `/auth/login` | No | Login, sets JWT cookies |
| `GET` | `/auth/refresh` | Refresh token | Refresh access token |
| `GET` | `/auth/logout` | Refresh token | Clear session and cookies |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users/me` | Required | Authenticated user's full profile |
| `PATCH` | `/users/me` | Required | Update own username, language, or image |
| `DELETE` | `/users/me` | Required | Delete own account |
| `GET` | `/users/:id` | Required | Any user's public profile `{ id, username, image }` |

---

## Running (via Docker Compose)

```bash
# Start everything:
docker compose up --build

# Dev shell inside the backend container:
docker compose exec backend sh
```

`DATABASE_URL` is assembled from Docker secrets at container startup — see the root `docker-compose.yml`.

---

## Tests

```bash
# Unit tests (no DB needed) — from project root via Docker:
npm run test

# Unit tests — inside the running container:
docker compose exec backend npm test

# E2e tests (DB must be running):
docker compose exec backend npm run test:e2e

# Coverage:
docker compose exec backend npm run test:cov
```

Unit tests mock `AppService` — no live DB required.
E2e tests boot the full `AppModule` and need `DATABASE_URL` to be set.

Test files: `src/**/*.spec.ts` (unit) · `test/**/*.e2e-spec.ts` (e2e)
