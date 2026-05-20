# TrailerTinder — CLAUDE.md

TikTok-style movie discovery app: users swipe through trailers to find films they want to watch, with social features and real-time group sessions.

---

## Tech Stack

| Layer | Technology | Status |
|---|---|---|
| Frontend | Vue 3 + Vite + TypeScript + Tailwind CSS + Reka UI | Decided |
| Backend | NestJS + TypeScript | Decided |
| ORM | Prisma | Decided |
| Database | PostgreSQL 16 | Decided |
| Auth | OAuth 2.0 (Google + 42) | Decided |
| Real-time | WebSockets (library TBD) | Open |
| Movie data | TMDB API (provisional) | Open |
| Trailer source | YouTube embeds (provisional) | Open |
| Containerization | Docker + docker-compose | Decided |
| Hosting | TBD | Open |

---

## Directory Structure

```
ft_transcendence/
├── frontend/          Vue 3 app (Vite, Tailwind, Reka UI)
├── backend/           NestJS API
├── _meta/
│   ├── product/       Product requirements and MVP scope
│   └── doc/           Technical decisions, workflow, roadmap
├── secrets/           Obsolete — can be deleted (*.txt files are gitignored and no longer used)
├── .env               Non-sensitive config vars (gitignored)
├── .env.example       Template for .env (committed)
├── docker-compose.yml
└── CLAUDE.md          This file
```

---

## Development Setup

```
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- pgAdmin: `http://localhost:5050` (login: `PGADMIN_EMAIL` and `PGADMIN_PASSWORD` from `.env` — email must be a valid address, e.g. `admin@example.com`)
- PostgreSQL: `localhost:5432`

**Installing packages:** Always install from inside the running container — this updates `package.json`/`package-lock.json` on the host and installs into the Docker volume. No restart needed:

```bash
docker compose exec frontend sh -c "npm install <package>"
docker compose exec backend  sh -c "npm install <package>"
```

See `_meta/doc/ARCHITECTURE.md` for full tech stack decisions.
See `backend/CLAUDE.md` and `frontend/CLAUDE.md` for folder-specific conventions, test commands, and formatting setup.

---

## Environment Variables

All config and credentials live in `.env` (gitignored). `.env.example` is the committed template.

No values are hardcoded in `docker-compose.yml` — all are interpolated as `${VAR}` from `.env`.

When adding a new config value:
1. Add `VAR_NAME=example_value` to `.env.example` and `.env` (with the real value)
2. Add `VAR_NAME: ${VAR_NAME}` to the relevant service's `environment:` block in `docker-compose.yml`
3. Consume via `process.env.VAR_NAME` in NestJS

Never hardcode values directly in `docker-compose.yml`.

---

## CI Checks

Run the full CI suite locally (Docker must be running, no full stack required):

```bash
npm run check          # format:check + lint + type-check/test for both layers
```

Or per layer:

```bash
docker compose run --rm --no-deps frontend npm run check
docker compose run --rm --no-deps backend  npm run check
```

The pre-commit hook only covers staged files (Prettier only); `npm run check` runs all files, identical to CI.

---

## Commit Policy

- **Claude writes commit messages** following [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, etc.)
- **Claude creates commits** — but only when explicitly asked by the user
- **Claude never pushes** to any remote, under any circumstances
- **Claude never force-pushes, amends published commits, or resets hard** without explicit user instruction

When asked to commit, Claude stages the relevant files and commits immediately — no confirmation step.
