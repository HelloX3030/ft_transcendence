# TrailerTinder — CLAUDE.md

TikTok-style movie discovery app: users swipe through trailers to find films they want to watch, with social features and real-time group sessions.

---

## Development Setup

```
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- pgAdmin: `http://localhost:5050` (login: `PGADMIN_EMAIL` and `PGADMIN_PASSWORD` from `.env` — email must be a valid address, e.g. `admin@example.com`)
- PostgreSQL: `localhost:5432`

**Installing packages:** Always install from inside the running container — this updates `package.json`/`package-lock.json` on the host. Then run `npm install` locally in the same directory to sync IDE IntelliSense. No restart needed:

```bash
docker compose exec frontend sh -c "npm install <package>"
docker compose exec backend  sh -c "npm install <package>"
```

See `_meta/doc/ARCHITECTURE.md` for full tech stack decisions.

---

## Environment Variables

All config and credentials live in `.env` (gitignored). `.env.example` is the committed template.

No values are hardcoded in `docker-compose.yml` — all are interpolated as `${VAR}` from `.env`.

**Backend var:**
1. Add `VAR_NAME=example_value` to `.env.example` and `.env` (with the real value)
2. Add `VAR_NAME: ${VAR_NAME}` to the backend service's `environment:` block in `docker-compose.yml`
3. Add it to the Joi schema in `backend/src/app.module.ts` (`Joi.string().required()` or with `.default(...)`)
4. Consume via `process.env.VAR_NAME` in NestJS

**Frontend var (`VITE_` prefix):**
1. Add `VITE_VAR=example_value` to `.env.example` and `frontend/.env` (with the real value)
2. Add `VITE_VAR: ${VITE_VAR}` to the frontend service's `environment:` block in `docker-compose.yml`
3. Add the type to the `ImportMetaEnv` interface in `frontend/env.d.ts`
4. If required at runtime: add the key to the `required` array in `frontend/vite.config.ts`

Never hardcode values directly in `docker-compose.yml`.

---

## CI Checks

Two commands cover all workflows from the project root:

```bash
npm run fix    # auto-fix formatting + lint issues (both layers)
npm run check  # read-only: format + lint + type-check + tests — identical to CI
npm run test   # backend unit tests only
```

All three run inside Docker (`node:22`) — no local Node version requirement. `npm run check` is the full CI equivalent: frontend check (incl. vitest unit tests) + backend check + backend unit tests.

The pre-commit hook covers only staged files (Prettier only); `npm run check` runs all files.

---
