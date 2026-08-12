# DB Request — Recommendation Service

> **RESOLVED** (2026-06-24, migration `20260624115724_add_recommendation_fields`, PR #163).
> The backend team implemented the request with two deviations from the spec below —
> both fine for our purposes, and `db.py` is written against the actual schema:
>
> 1. No separate `user_profiles` / `user_preferences` tables. All fields live on `users`:
>    `feature_vector Float[]`, `feat_vec_updated_at DateTime?`, `genre_ids Int[]`,
>    `actor_ids Int[]`, `director_ids Int[]`, plus a bonus `onboarding_completed Boolean`.
> 2. `ratings.watch_time` is `Int? @db.SmallInt` (whole seconds), not `Float?`.
>
> The rest of this file is kept as the original request for reference.

These are the schema additions the recommendation service needs.
Please add them as a Prisma migration when convenient.

---

## 1. Add `watch_time` to `ratings`

```prisma
model ratings {
  // ... existing fields ...
  watchTime Float? @map("watch_time")
}
```

Nullable. Only populated for `skip_fast` and `watched_long` signals — all other actions leave it null.

---

## 2. New table: `user_profiles`

Stores the recommendation service's learned taste profile per user.
One row per user, written after every interaction, read on service startup.

```prisma
model user_profiles {
  userId        Int       @id @map("user_id")
  featureVector Float[]   @map("feature_vector")
  updatedAt     DateTime  @map("updated_at")

  user users @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

`featureVector` is a list of ~1500 floats representing the user's taste across genres, keywords, and cast.
Think of it as a numeric fingerprint of what they like — we write it, we read it, no need to query into it.

---

## 3. New table: `user_preferences`

Stores the explicit genre / actor / director selections from onboarding.
Used as the cold-start signal for new users who have no swipe history yet.

```prisma
model user_preferences {
  userId      Int   @id @map("user_id")
  genreIds    Int[] @map("genre_ids")
  actorIds    Int[] @map("actor_ids")
  directorIds Int[] @map("director_ids")

  user users @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

The frontend onboarding writes to this table. The recommendation service reads it once when a new user's first feed is requested.

---

## Note on IDs

TMDB genre IDs, actor IDs, and director IDs are stored directly (e.g. TMDB genre 28 = Action).
No mapping table needed — we use TMDB IDs throughout.
