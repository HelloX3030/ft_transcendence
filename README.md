# TrailerTinder

> Discover movies through short trailers — swipe, like, and watch together.

TrailerTinder is a mobile-first web app where users swipe through film trailers TikTok-style to find movies they want to watch. A recommendation engine learns from your behavior, and the Movie Night Mode lets you and friends swipe simultaneously to find a film everyone agrees on.

---

## Documentation

- [Architecture & Tech Decisions](_meta/doc/ARCHITECTURE.md)
- [Implementation Roadmap](_meta/doc/ROADMAP.md)

---

## Setup

**1. Create secret files** (first time only):

```bash
cp secrets/db_user.txt.example     secrets/db_user.txt
cp secrets/db_password.txt.example secrets/db_password.txt
cp secrets/db_name.txt.example     secrets/db_name.txt
```

Edit `secrets/db_password.txt` to set a real password if desired.

**2. Start the stack:**

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| PostgreSQL | localhost:5432 |

On subsequent runs `--build` can be omitted unless dependencies changed.
