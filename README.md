# TrailerTinder

> Discover movies through short trailers — swipe, like, and watch together.

TrailerTinder is a mobile-first web app where users swipe through film trailers TikTok-style to find movies they want to watch. A recommendation engine learns from your behavior, and the Movie Night Mode lets you and friends swipe simultaneously to find a film everyone agrees on.

---

## Documentation

- [Architecture & Tech Decisions](_meta/doc/ARCHITECTURE.md)
- [Implementation Roadmap](_meta/doc/ROADMAP.md)

---

## Setup

**1. Create config and secret files** (first time only):

```bash
cp .env.example .env

cp secrets/db_user.txt.example          secrets/db_user.txt
cp secrets/db_password.txt.example      secrets/db_password.txt
cp secrets/db_name.txt.example          secrets/db_name.txt
cp secrets/pgadmin_password.txt.example secrets/pgadmin_password.txt
```

Edit the `*.txt` files to set real passwords if desired.

**2. Start the stack:**

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| pgAdmin | http://localhost:5050 |
| PostgreSQL | localhost:5432 |

On subsequent runs `--build` can be omitted unless dependencies changed.

---

## Testing

**Unit tests** (no DB required):

```bash
docker compose exec backend npm test
```

**E2e tests** (DB must be running):

```bash
# With the full stack up:
docker compose exec backend npm run test:e2e

# Or locally against the port-forwarded DB (docker compose up db first):
cd backend
DATABASE_URL="postgresql://$(cat ../secrets/db_user.txt):$(cat ../secrets/db_password.txt)@localhost:5432/$(cat ../secrets/db_name.txt)" npm run test:e2e
```

Test files: `backend/src/**/*.spec.ts` (unit) · `backend/test/**/*.e2e-spec.ts` (e2e)
