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
- PostgreSQL: `localhost:5432`

See `_meta/doc/ARCHITECTURE.md` for full tech stack decisions.

---

## Commit Policy

- **Claude writes commit messages** following [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, etc.)
- **Claude creates commits** — but only when explicitly asked by the user
- **Claude never pushes** to any remote, under any circumstances
- **Claude never force-pushes, amends published commits, or resets hard** without explicit user instruction

When asked to commit, Claude stages the relevant files and commits immediately — no confirmation step.
