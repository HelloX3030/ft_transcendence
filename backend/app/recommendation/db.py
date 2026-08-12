"""
db.py — persistence against the shared Prisma-managed PostgreSQL schema.

The backend team put the recommendation fields directly on existing tables
(migration 20260624115724_add_recommendation_fields) instead of the separate
tables requested in DB_REQUEST.md:

    users.feature_vector      DOUBLE PRECISION[]   learned taste profile
    users.feat_vec_updated_at TIMESTAMP(3)         last profile write
    users.genre_ids /
          actor_ids /
          director_ids        INTEGER[]            onboarding cold-start prefs
    ratings.watch_time        SMALLINT             seconds watched (nullable)

Two ID systems meet here: the service is TMDB-id-native, while ratings.movie_id
references the internal movies.id — every history query joins movies to map to
movies.tmdb_id. User IDs are Int in the DB and str at the service boundary.

Profile wire format (encode_profile / decode_feature_vector): the sparse weight
dicts are flattened into one self-describing float array —

    [VERSION, interaction_count, avg_vote,
     n_genre, n_actor, n_director, n_keyword,
     <genre id/weight pairs>, <actor pairs>, <director pairs>, <keyword pairs>]

Doubles represent both TMDB ids and counts exactly (all < 2^53). liked_overviews
cannot live in a float array — the overview-TF-IDF component rebuilds from new
likes after a restart (known, accepted gap; see PROGRESS.md).
"""

import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg

from .content_based import UserProfile

logger = logging.getLogger(__name__)

_FORMAT_VERSION = 1.0

# Header layout: version, interaction_count, avg_vote, then one length per section.
_HEADER_LEN = 7
_SECTIONS = ("genre_weights", "actor_weights", "director_weights", "keyword_weights")


# ---------------------------------------------------------------------------
# Profile <-> feature_vector encoding (pure, unit-testable)
# ---------------------------------------------------------------------------


def encode_profile(profile: UserProfile) -> list[float]:
    """Flatten the profile's sparse weight dicts into users.feature_vector."""
    vec: list[float] = [
        _FORMAT_VERSION,
        float(profile.interaction_count),
        profile.avg_vote,
    ]
    sections = [getattr(profile, name) for name in _SECTIONS]
    vec.extend(float(len(s)) for s in sections)
    for section in sections:
        for wid, weight in sorted(section.items()):
            vec.append(float(wid))
            vec.append(weight)
    return vec


def decode_feature_vector(user_id: str, vec: list[float]) -> UserProfile | None:
    """Rebuild a UserProfile from users.feature_vector. None if empty/unreadable."""
    if not vec or len(vec) < _HEADER_LEN or vec[0] != _FORMAT_VERSION:
        return None

    counts = [int(n) for n in vec[3:_HEADER_LEN]]
    if len(vec) != _HEADER_LEN + 2 * sum(counts):
        logger.warning("feature_vector for user %s has inconsistent length", user_id)
        return None

    profile = UserProfile(
        user_id=user_id,
        interaction_count=int(vec[1]),
        avg_vote=vec[2],
    )
    pos = _HEADER_LEN
    for name, count in zip(_SECTIONS, counts):
        section = getattr(profile, name)
        for _ in range(count):
            section[int(vec[pos])] = vec[pos + 1]
            pos += 2
    return profile


def apply_onboarding_prefs(
    profile: UserProfile,
    genre_ids: list[int],
    actor_ids: list[int],
    director_ids: list[int],
) -> UserProfile:
    """
    Seed the profile with explicit onboarding selections (architecture 1.5).
    Only fills ids the profile has no learned weight for yet — interaction-derived
    weights (including negative ones from dislikes) always win.
    """
    for gid in genre_ids:
        profile.genre_weights.setdefault(gid, 1.0)
    for aid in actor_ids:
        profile.actor_weights.setdefault(aid, 1.0)
    for did in director_ids:
        profile.director_weights.setdefault(did, 1.0)
    return profile


def _row_to_profile(user_id: str, row) -> UserProfile:
    profile = decode_feature_vector(user_id, row["feature_vector"] or [])
    if profile is None:
        profile = UserProfile(user_id=user_id)
    return apply_onboarding_prefs(
        profile,
        row["genre_ids"] or [],
        row["actor_ids"] or [],
        row["director_ids"] or [],
    )


# ---------------------------------------------------------------------------
# Connection / queries
# ---------------------------------------------------------------------------


def _clean_dsn(dsn: str) -> str:
    """Strip Prisma-only query params (e.g. ?schema=public) that asyncpg rejects."""
    parts = urlsplit(dsn)
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query) if k != "schema"])
    return urlunsplit(parts._replace(query=query))


def _db_user_id(user_id: str) -> int | None:
    """users.id is Int; the service API uses str. None for non-numeric ids."""
    try:
        return int(user_id)
    except ValueError:
        logger.warning("non-numeric user_id %r — skipping DB access", user_id)
        return None


_PROFILE_COLUMNS = "feature_vector, genre_ids, actor_ids, director_ids"


class Database:
    """asyncpg-backed persistence. One instance per service, pooled connections."""

    def __init__(self, dsn: str) -> None:
        self._dsn = _clean_dsn(dsn)
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=5)

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    # -- profiles -------------------------------------------------------

    async def load_all_profiles(self) -> list[UserProfile]:
        """Startup bulk load: every user with a stored vector or onboarding prefs."""
        assert self._pool is not None
        rows = await self._pool.fetch(
            f"""
            SELECT id, {_PROFILE_COLUMNS}
            FROM users
            WHERE cardinality(feature_vector) > 0
               OR cardinality(genre_ids) > 0
               OR cardinality(actor_ids) > 0
               OR cardinality(director_ids) > 0
            """
        )
        return [_row_to_profile(str(row["id"]), row) for row in rows]

    async def load_profile(self, user_id: str) -> UserProfile | None:
        """Single-user load for users who registered after service startup."""
        assert self._pool is not None
        uid = _db_user_id(user_id)
        if uid is None:
            return None
        row = await self._pool.fetchrow(
            f"SELECT id, {_PROFILE_COLUMNS} FROM users WHERE id = $1", uid
        )
        if row is None:
            return None
        return _row_to_profile(user_id, row)

    async def save_profile(self, profile: UserProfile) -> None:
        assert self._pool is not None
        uid = _db_user_id(profile.user_id)
        if uid is None:
            return
        # feat_vec_updated_at is TIMESTAMP without time zone — asyncpg wants naive UTC.
        updated_at = profile.last_updated.replace(tzinfo=None)
        await self._pool.execute(
            "UPDATE users SET feature_vector = $2, feat_vec_updated_at = $3 WHERE id = $1",
            uid,
            encode_profile(profile),
            updated_at,
        )

    # -- interaction history ---------------------------------------------

    async def fetch_seen_tmdb_ids(self, user_id: str) -> list[int]:
        """TMDB ids of every movie the user has rated — feed deduplication."""
        assert self._pool is not None
        uid = _db_user_id(user_id)
        if uid is None:
            return []
        rows = await self._pool.fetch(
            """
            SELECT m.tmdb_id
            FROM ratings r
            JOIN movies m ON m.id = r.movie_id
            WHERE r.user_id = $1
            """,
            uid,
        )
        return [row["tmdb_id"] for row in rows]

    async def fetch_interactions(self) -> list[tuple[str, int, float]]:
        """All (user_id, tmdb_id, ±1.0) rows — the SVD training matrix (retrain.py)."""
        assert self._pool is not None
        rows = await self._pool.fetch(
            """
            SELECT r.user_id, m.tmdb_id,
                   CASE WHEN r.trailer_rating = 'like' THEN 1.0 ELSE -1.0 END AS rating
            FROM ratings r
            JOIN movies m ON m.id = r.movie_id
            """
        )
        return [(str(row["user_id"]), row["tmdb_id"], float(row["rating"])) for row in rows]
