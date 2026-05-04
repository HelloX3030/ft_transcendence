# TrailerTinder — Open Questions

Unresolved decisions that block implementation. Resolve before the relevant phase starts.
When resolved, move the decision to [ARCHITECTURE.md](ARCHITECTURE.md) and delete it here.

---

## Blocks Phase 0

### Which database?

PostgreSQL 16 recommended — fits the relational model, works with Prisma, easy in Docker.
Alternatives: SQLite (dev only), MongoDB (adds complexity for relational data).

---

## Blocks Phase 1

### Do we have 42 OAuth credentials?

Whoever has access to the 42 intranet app registration shares the credentials via `.env` (not committed).

### passport.js or custom OAuth?

passport.js: handles multiple strategies, more abstraction.
Custom: less magic, easier to debug, fewer dependencies.

---

## Blocks Phase 2

### Do we have a TMDB API key?

Register at the TMDB developer portal. Free tier is sufficient for development.

### Does YouTube auto-play work in this use case?

YouTube embeds support muted auto-play — check ToS for app/commercial use.
Fallback: TMDB provides direct MP4 links for some trailers.

### What's the film catalog scoping logic?

Options: all TMDB films above a popularity threshold, streaming-availability filter (requires extra API), or curated subset.

---

## Blocks Phase 4

### Which recommendation algorithm?

Options: content-based, collaborative filtering, hybrid, or a simple genre heuristic to start.
Check with evaluators what counts as "ML" for module 5.

### How is dwell time defined and weighted?

Define: what counts as a view (e.g. > 5 s), how it's stored, how it weighs against explicit likes.

---

## Blocks Phase 5

### socket.io or native ws?

socket.io: rooms built-in (maps perfectly to Movie Night sessions), reconnection handling.
ws: minimal, no abstraction, manual room management required.
Recommendation: socket.io.

---

## General

### PWA?

Adds service worker + manifest. Needs a decision before the final deployment phase.

### MVP timeline — which weeks map to which phases?

### Hosting / deployment target?

Affects Docker config, env vars, and CORS settings.
