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
├── app.module.ts          Root module — imports PrismaModule, registers AppController + AppService
├── app.controller.ts      HTTP endpoints (see below)
├── app.service.ts         Business logic
├── prisma/
│   ├── prisma.module.ts   Global module — exports PrismaService to all modules
│   └── prisma.service.ts  Extends PrismaClient, connects on ModuleInit
└── main.ts                Bootstrap — port from $PORT or 3000, CORS enabled
```

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: "ok" }` |
| `GET` | `/api/ping` | Returns `{ message: "pong", db_time }` — verifies DB connectivity |

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
# Unit tests (no DB needed):
docker compose exec backend npm test

# E2e tests (DB must be running):
docker compose exec backend npm run test:e2e

# Coverage:
docker compose exec backend npm run test:cov
```

Unit tests mock `AppService` — no live DB required.
E2e tests boot the full `AppModule` and need `DATABASE_URL` to be set.

Test files: `src/**/*.spec.ts` (unit) · `test/**/*.e2e-spec.ts` (e2e)
