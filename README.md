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

**2. Activate git hooks** (first time only):

```bash
npm install
```

This installs husky and wires up the pre-commit hook. Without this step, lint and format checks won't run locally before commits.

The hook runs lint-staged inside a `node:22` Docker container so it works regardless of your host Node version. **Docker must be running when you commit** — on first use it pulls the image (~1.1 GB, cached after that). If Docker is not running the hook skips with a warning and CI verifies instead.

**3. Start the stack:**

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

**VS Code:** Open the repo and accept the "Install recommended extensions" prompt — this sets up Prettier (format on save) and ESLint automatically.

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
