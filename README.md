# TrailerTinder

> Discover movies through short trailers — swipe, like, and watch together.

TrailerTinder is a mobile-first web app where users swipe through film trailers TikTok-style to find movies they want to watch. A recommendation engine learns from your behavior, and the Movie Night Mode lets you and friends swipe simultaneously to find a film everyone agrees on.

---

## Documentation

- [Architecture & Tech Decisions](_meta/doc/ARCHITECTURE.md)
- [Implementation Roadmap](_meta/doc/ROADMAP.md)

---

## Setup

**1. Create the config file** (first time only):

```bash
cp .env.example .env
```

Edit `.env` to set real passwords if desired.

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

On subsequent runs `--build` can be omitted — node modules live in named Docker volumes and are installed automatically on first container start.

**Adding a package:**

Always install from inside the running container, not on the host. This updates `package.json` and `package-lock.json` on the host (via the bind-mount) and installs into the container's volume:

```bash
docker compose exec frontend sh -c "npm install <package>"
docker compose exec backend  sh -c "npm install <package>"
```

The container keeps running — no restart needed. Running `npm install <package>` on the host won't work; the container's `node_modules` volume won't see it.

**Full reset** (e.g. after a merge conflict in the lock file):

```bash
docker compose down -v && docker compose up
```

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
source ../.env && npm run test:e2e
```

Test files: `backend/src/**/*.spec.ts` (unit) · `backend/test/**/*.e2e-spec.ts` (e2e)

---

## Code Quality

Run the full CI check suite locally (Docker must be running, no full stack required):

```bash
npm run check
```

Or target a single layer:

```bash
docker compose run --rm --no-deps frontend sh -c 'npm run format:check && npm run lint && npm run type-check'
docker compose run --rm --no-deps backend  sh -c 'npm run format:check && npm run lint && npm run test'
```

The pre-commit hook covers only staged files; `npm run check` runs all files, identical to CI.
