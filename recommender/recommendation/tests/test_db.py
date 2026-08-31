from recommendation.content_based import UserProfile
from recommendation.db import (
    _clean_dsn,
    apply_onboarding_prefs,
    decode_feature_vector,
    encode_profile,
)

# ---------------------------------------------------------------------------
# encode_profile / decode_feature_vector round-trip
# ---------------------------------------------------------------------------


def _warm_profile() -> UserProfile:
    return UserProfile(
        user_id="7",
        interaction_count=14,
        genre_weights={28: 3.0, 12: 2.0, 27: -0.5},
        actor_weights={6193: 1.0},
        director_weights={525: 2.0},
        keyword_weights={4565: 1.5, 818: 0.5},
        avg_vote=6.8,
    )


def test_round_trip_preserves_all_weight_dicts():
    original = _warm_profile()
    decoded = decode_feature_vector("7", encode_profile(original))

    assert decoded is not None
    assert decoded.user_id == "7"
    assert decoded.interaction_count == 14
    assert decoded.avg_vote == 6.8
    assert decoded.genre_weights == original.genre_weights
    assert decoded.actor_weights == original.actor_weights
    assert decoded.director_weights == original.director_weights
    assert decoded.keyword_weights == original.keyword_weights


def test_round_trip_empty_profile():
    decoded = decode_feature_vector("1", encode_profile(UserProfile(user_id="1")))
    assert decoded is not None
    assert decoded.interaction_count == 0
    assert decoded.genre_weights == {}


def test_negative_weights_survive():
    profile = UserProfile(user_id="1", genre_weights={27: -1.5})
    decoded = decode_feature_vector("1", encode_profile(profile))
    assert decoded is not None
    assert decoded.genre_weights[27] == -1.5


def test_decode_empty_vector_returns_none():
    assert decode_feature_vector("1", []) is None


def test_decode_unknown_version_returns_none():
    vec = encode_profile(_warm_profile())
    vec[0] = 99.0
    assert decode_feature_vector("7", vec) is None


def test_decode_truncated_vector_returns_none():
    vec = encode_profile(_warm_profile())
    assert decode_feature_vector("7", vec[:-1]) is None


# ---------------------------------------------------------------------------
# apply_onboarding_prefs
# ---------------------------------------------------------------------------


def test_onboarding_seeds_fresh_profile():
    profile = apply_onboarding_prefs(
        UserProfile(user_id="1"), genre_ids=[28, 12], actor_ids=[6193], director_ids=[525]
    )
    assert profile.genre_weights == {28: 1.0, 12: 1.0}
    assert profile.actor_weights == {6193: 1.0}
    assert profile.director_weights == {525: 1.0}


def test_onboarding_never_overwrites_learned_weights():
    # Genre 28 was actively disliked (-0.5) — the onboarding pick must not reset it.
    profile = UserProfile(user_id="1", genre_weights={28: -0.5, 12: 3.0})
    apply_onboarding_prefs(profile, genre_ids=[28, 12, 35], actor_ids=[], director_ids=[])
    assert profile.genre_weights == {28: -0.5, 12: 3.0, 35: 1.0}


# ---------------------------------------------------------------------------
# DSN cleanup
# ---------------------------------------------------------------------------


def test_clean_dsn_strips_prisma_schema_param():
    dsn = "postgresql://user:pw@db:5432/app?schema=public"
    assert _clean_dsn(dsn) == "postgresql://user:pw@db:5432/app"


def test_clean_dsn_keeps_other_params():
    dsn = "postgresql://user:pw@db:5432/app?schema=public&sslmode=require"
    assert _clean_dsn(dsn) == "postgresql://user:pw@db:5432/app?sslmode=require"


def test_clean_dsn_without_query_is_unchanged():
    dsn = "postgresql://user:pw@db:5432/app"
    assert _clean_dsn(dsn) == dsn
