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

**2. Install local dependencies** (first time only):

```bash
npm run setup
```

This does three things in one step:
- Installs Husky at the repo root and wires up the pre-commit hook
- Installs `node_modules` locally in `frontend/` and `backend/` so your IDE (VS Code, WebStorm, etc.) gets full IntelliSense

> **Engine warnings are expected** if your local Node is older than 20.19.0 — the install still completes successfully. All tools (`fix`, `check`, `test`) run inside Docker so your host Node version doesn't matter.

The hook runs lint-staged inside a `node:22` Docker container so it works regardless of your host Node version. **Docker must be running when you commit** — on first use it pulls the image (~1.1 GB, cached after that). If Docker is not running the hook skips with a warning and CI verifies instead.

> **Note:** The local `node_modules` are only for the IDE — the app always runs inside Docker using isolated named volumes. Never use the local `node_modules` to run the app or tests.

**3. Start the stack:**

```bash
docker compose up --build
```

| Service     | URL                   |
| ----------- | --------------------- |
| Frontend    | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| pgAdmin     | http://localhost:5050 |
| PostgreSQL  | localhost:5432        |

On subsequent runs `--build` can be omitted — node modules live in named Docker volumes and are installed automatically on first container start.

**Adding a package:**

Always install from inside the running container. This updates `package.json` and `package-lock.json` on the host (via the bind-mount) and installs into the container's named volume:

```bash
docker compose exec frontend sh -c "npm install <package>"
docker compose exec backend  sh -c "npm install <package>"
```

The container keeps running — no restart needed. Then sync your local IDE node_modules:

```bash
cd frontend && npm install   # or backend/
```

**Full reset** (e.g. after a merge conflict in the lock file):

```bash
docker compose down -v && docker compose up
```

**VS Code:** Open the repo and accept the "Install recommended extensions" prompt — this sets up Prettier (format on save) and ESLint automatically.

**4. Run Prisma Setup:**

```bash
docker compose exec backend  sh -c "npx prisma migrate dev"
```

`npx prisma migrate dev`: Applies database migrations in development, creating or updating your database schema to match your Prisma schema.

---

## Testing

**Unit tests** (no DB required):

```bash
npm run test                         # via Docker from the project root
docker compose exec backend npm test # inside the running container
```

**E2e tests** (DB must be running):

```bash
docker compose exec backend npm run test:e2e
```

Test files: `backend/src/**/*.spec.ts` (unit) · `backend/test/**/*.e2e-spec.ts` (e2e)

---

## Code Quality

Three commands cover everything, run from the project root via Docker (no local Node version required):

```bash
npm run fix    # auto-fix formatting + lint issues
npm run check  # read-only validation: format + lint + type-check + tests — identical to CI
npm run test   # backend unit tests only
```

The pre-commit hook covers only staged files; `npm run check` runs all files.
