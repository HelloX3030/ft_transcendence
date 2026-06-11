"""
TMDB bridge, part 1: parameter translation (profile -> Discover query params).

Pure logic, no I/O — fully unit-testable without network access.
Part 2 (fetch_candidates: the actual Discover HTTP call, pagination, dedup)
lands separately once TMDB_API_KEY / Docker wiring exists.
"""

from datetime import date
from typing import Protocol
from zlib import crc32

from .config import DEFAULT_CONFIG, RecommenderConfig


class TranslatableProfile(Protocol):
    """The slice of a user profile the translation reads. Structural — any
    object with these fields works (concrete type: content_based.UserProfile)."""

    user_id: str
    interaction_count: int
    genre_weights: dict[int, float]
    actor_weights: dict[int, float]
    director_weights: dict[int, float]
    keyword_weights: dict[int, float]
    avg_vote: float


def profile_to_params(
    profile: TranslatableProfile,
    *,
    diversify: bool = False,
    config: RecommenderConfig = DEFAULT_CONFIG,
    today: date | None = None,
) -> dict[str, str | int | float]:
    """
    Translate a user profile into TMDB Discover query parameters.

    The translation is intentionally lossy — it approximates the
    high-dimensional profile; re-ranking on the returned pool compensates.
    Cold-start users (onboarding genres only, or nothing at all) flow through
    the same path: empty weight dicts simply omit their parameter.

    Args:
        profile:   User taste profile (weights may be empty for new users).
        diversify: Drop the dominant genre from with_genres (anti-filter-bubble).
        config:    Hyperparameters (top-N counts, thresholds, page window).
        today:     Override for the page-rotation date (tests); defaults to date.today().

    Returns:
        Discover params keyed by TMDB query-parameter name. Always contains
        sort_by, vote_count.gte and page; everything else only when the
        profile carries a signal for it.
    """
    params: dict[str, str | int | float] = {
        "sort_by": "popularity.desc",
        "vote_count.gte": config.tmdb_min_vote_count,
        "page": _rotated_page(profile.user_id, today or date.today(), config.tmdb_page_window),
    }

    genres = _top_ids(profile.genre_weights, config.tmdb_top_genres + (1 if diversify else 0))
    if diversify and genres:
        # _top_ids is weight-sorted, so the dominant genre is first. Drop it and
        # let the extra slot fetched above refill back to the configured count.
        genres = genres[1:]
    if genres:
        # Comma = AND in TMDB Discover (per spec: top genres AND-joined).
        params["with_genres"] = ",".join(map(str, genres))

    keywords = _top_ids(profile.keyword_weights, config.tmdb_top_keywords)
    if keywords:
        # Pipe = OR. AND-joining several keywords would over-constrain Discover
        # to a near-empty result set, unlike the broad genre dimensions.
        params["with_keywords"] = "|".join(map(str, keywords))

    cast = _top_ids(profile.actor_weights, config.tmdb_top_cast, config.tmdb_min_person_weight)
    if cast:
        params["with_cast"] = "|".join(map(str, cast))

    crew = _top_ids(profile.director_weights, config.tmdb_top_crew, config.tmdb_min_person_weight)
    if crew:
        params["with_crew"] = "|".join(map(str, crew))

    if profile.avg_vote > 0:
        params["vote_average.gte"] = round(profile.avg_vote, 1)

    return params


def _top_ids(weights: dict[int, float], n: int, min_weight: float = 0.0) -> list[int]:
    """Top-n TMDB IDs by weight, strongest first. Non-positive and
    below-threshold weights never qualify (disliked signals stay out)."""
    threshold = max(min_weight, 0.0)
    ranked = sorted(
        ((wid, w) for wid, w in weights.items() if w > threshold),
        key=lambda item: item[1],
        reverse=True,
    )
    return [wid for wid, _ in ranked[:n]]


def _rotated_page(user_id: str, today: date, window: int) -> int:
    """Daily page rotation: shifts the Discover result window per user per day
    so identical params don't serve the same 60 films forever. crc32 instead of
    hash() — the latter is salted per process and would break determinism."""
    seed = f"{user_id}:{today.isoformat()}"
    return crc32(seed.encode()) % window + 1
