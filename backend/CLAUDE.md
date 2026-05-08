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
├── app.controller.ts      HTTP endpoints
├── app.service.ts         Business logic
├── prisma/
│   ├── prisma.module.ts   Global module — exports PrismaService to all modules
│   └── prisma.service.ts  Extends PrismaClient, connects on ModuleInit
└── main.ts                Bootstrap — port from $PORT or 3000, CORS enabled
```

---

## Conventions

**Adding a new feature module:** create a module + controller + service triplet, then import the module into `AppModule`. `PrismaModule` is global — inject `PrismaService` directly without re-importing the module.

---

## Testing

Unit tests mock `AppService` — no live DB required.  
E2e tests boot the full `AppModule` and need `DATABASE_URL` to be set.

```bash
# Unit tests (no DB needed):
docker compose exec backend npm test

# E2e tests (DB must be running):
docker compose exec backend npm run test:e2e

# Or locally against the port-forwarded DB (docker compose up db first):
DATABASE_URL="postgresql://$(cat ../secrets/db_user.txt):$(cat ../secrets/db_password.txt)@localhost:5432/$(cat ../secrets/db_name.txt)" npm run test:e2e

# Coverage:
docker compose exec backend npm run test:cov
```

Test files: `src/**/*.spec.ts` (unit) · `test/**/*.e2e-spec.ts` (e2e)

---

## Formatting

Backend uses `.prettierrc` and `eslint.config.mjs`.

```bash
docker compose exec backend npm run format   # Prettier
docker compose exec backend npm run lint     # ESLint
```

---

## Keeping README.md in sync

`backend/README.md` is the human-readable reference for module structure, endpoints, and test commands. Update it whenever:

- A new NestJS module, controller, or service is added or removed
- A new HTTP endpoint is added or changed
- Test infrastructure changes (new test type, new commands, etc.)
