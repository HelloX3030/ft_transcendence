import numpy as np
import pytest

from recommendation.content_based import ContentBasedFilter, UserProfile
from recommendation.config import RecommenderConfig
from recommendation.schemas import MovieMetadata


def _filter() -> ContentBasedFilter:
    return ContentBasedFilter(RecommenderConfig())


def _movie(tmdb_id: int, genres: list[int] = (), overview: str = "") -> MovieMetadata:
    return MovieMetadata(tmdb_id=tmdb_id, genre_ids=list(genres), overview=overview)


# ---------------------------------------------------------------------------
# content_score — cold start
# ---------------------------------------------------------------------------


def test_cold_start_no_data_returns_zeros():
    f = _filter()
    profile = UserProfile(user_id="u1")
    candidates = [_movie(1, [28, 12]), _movie(2, [18])]
    scores = f.content_score(profile, candidates)
    assert list(scores) == [0.0, 0.0]


def test_empty_candidate_list_returns_empty():
    f = _filter()
    profile = UserProfile(user_id="u1", genre_weights={28: 1.0})
    scores = f.content_score(profile, [])
    assert scores.shape == (0,)


# ---------------------------------------------------------------------------
# genre similarity
# ---------------------------------------------------------------------------


def test_genre_match_scores_higher_than_mismatch():
    f = _filter()
    # User likes action (28) and adventure (12)
    profile = UserProfile(user_id="u1", genre_weights={28: 2.0, 12: 1.0})
    candidates = [
        _movie(1, [28, 12]),  # perfect match
        _movie(2, [18, 35]),  # no overlap
    ]
    scores = f.content_score(profile, candidates)
    assert scores[0] > scores[1]


def test_disliked_genre_scores_below_unrelated():
    f = _filter()
    # Negative genre weight → disliked
    profile = UserProfile(user_id="u1", genre_weights={28: -2.0, 18: 1.0})
    candidates = [
        _movie(1, [28]),   # disliked genre
        _movie(2, [99]),   # unrelated genre (no entry in profile)
    ]
    scores = f.content_score(profile, candidates)
    # Disliked-genre movie should score lower than the unrelated one
    assert scores[0] < scores[1]


def test_identical_genres_score_equally():
    f = _filter()
    profile = UserProfile(user_id="u1", genre_weights={28: 1.0})
    candidates = [_movie(1, [28]), _movie(2, [28])]
    scores = f.content_score(profile, candidates)
    assert pytest.approx(scores[0]) == scores[1]


def test_no_genre_weights_genre_component_is_zero():
    # No genre_weights but has liked_overviews — genre part should be zero.
    f = _filter()
    profile = UserProfile(user_id="u1", liked_overviews=["action adventure film"])
    candidates = [_movie(1, [28, 12], overview="action film")]
    scores = f.content_score(profile, candidates)
    # Overview component may be nonzero, but genre component is zero.
    # With beta=0.7, combined score = 0.7*0 + 0.3*overview_score = 0.3*overview_score.
    cfg = RecommenderConfig()
    assert scores[0] == pytest.approx((1.0 - cfg.beta) * f._overview_similarity(profile, candidates)[0])


# ---------------------------------------------------------------------------
# overview TF-IDF similarity
# ---------------------------------------------------------------------------


def test_matching_overview_scores_higher():
    f = _filter()
    profile = UserProfile(user_id="u1", liked_overviews=["superhero saves the world action"])
    candidates = [
        _movie(1, [], overview="superhero defeats villain to save the world"),
        _movie(2, [], overview="romantic comedy set in Paris"),
    ]
    scores = f._overview_similarity(profile, candidates)
    assert scores[0] > scores[1]


def test_empty_overviews_on_candidates_return_zero():
    f = _filter()
    profile = UserProfile(user_id="u1", liked_overviews=["some film overview"])
    candidates = [_movie(1, [], overview=""), _movie(2, [], overview="   ")]
    scores = f._overview_similarity(profile, candidates)
    assert np.all(scores == 0.0)


def test_no_liked_overviews_returns_zero():
    f = _filter()
    profile = UserProfile(user_id="u1")
    candidates = [_movie(1, [], overview="great film")]
    scores = f._overview_similarity(profile, candidates)
    assert np.all(scores == 0.0)


# ---------------------------------------------------------------------------
# combined score (beta weighting)
# ---------------------------------------------------------------------------


def test_beta_weights_genre_and_overview():
    cfg = RecommenderConfig(beta=0.7)
    f = ContentBasedFilter(cfg)
    profile = UserProfile(
        user_id="u1",
        genre_weights={28: 1.0},
        liked_overviews=["action film"],
    )
    candidate = _movie(1, [28], overview="action film")
    candidates = [candidate]

    genre_score = f._genre_similarity(profile, candidates)[0]
    overview_score = f._overview_similarity(profile, candidates)[0]
    expected = cfg.beta * genre_score + (1 - cfg.beta) * overview_score

    scores = f.content_score(profile, candidates)
    assert scores[0] == pytest.approx(expected)


# ---------------------------------------------------------------------------
# update_profile
# ---------------------------------------------------------------------------


def test_update_increments_interaction_count():
    f = _filter()
    f.update_profile("u1", 100, "like", 0.01)
    assert f.get_profile("u1").interaction_count == 1
    f.update_profile("u1", 101, "dislike", 0.01)
    assert f.get_profile("u1").interaction_count == 2


def test_like_with_metadata_updates_genre_weights():
    f = _filter()
    meta = MovieMetadata(tmdb_id=100, genre_ids=[28, 12], vote_average=7.5)
    f.update_profile("u1", 100, "like", 0.01, meta)
    profile = f.get_profile("u1")
    assert profile.genre_weights[28] == pytest.approx(1.0)
    assert profile.genre_weights[12] == pytest.approx(1.0)


def test_dislike_with_metadata_subtracts_genre_weights():
    f = _filter()
    meta = MovieMetadata(tmdb_id=100, genre_ids=[28], vote_average=5.0)
    f.update_profile("u1", 100, "dislike", 0.01, meta)
    profile = f.get_profile("u1")
    assert profile.genre_weights[28] < 0.0


def test_like_with_metadata_adds_overview_to_history():
    f = _filter()
    meta = MovieMetadata(tmdb_id=100, genre_ids=[], overview="A great film", vote_average=8.0)
    f.update_profile("u1", 100, "like", 0.01, meta)
    assert "A great film" in f.get_profile("u1").liked_overviews


def test_overview_history_capped_at_max():
    from recommendation.content_based import _MAX_OVERVIEW_HISTORY

    f = _filter()
    for i in range(_MAX_OVERVIEW_HISTORY + 10):
        meta = MovieMetadata(tmdb_id=i, genre_ids=[], overview=f"Film {i}")
        f.update_profile("u1", i, "like", 0.01, meta)
    assert len(f.get_profile("u1").liked_overviews) == _MAX_OVERVIEW_HISTORY


def test_update_without_metadata_only_increments_count():
    f = _filter()
    f.update_profile("u1", 999, "like", 0.01, metadata=None)
    profile = f.get_profile("u1")
    assert profile.interaction_count == 1
    assert profile.genre_weights == {}
    assert profile.liked_overviews == []


def test_avg_vote_updated_on_like():
    f = _filter()
    meta = MovieMetadata(tmdb_id=100, genre_ids=[], vote_average=8.0)
    f.update_profile("u1", 100, "like", 0.01, meta)
    assert f.get_profile("u1").avg_vote == pytest.approx(8.0)


def test_cumulative_likes_increase_genre_weight():
    f = _filter()
    meta = MovieMetadata(tmdb_id=1, genre_ids=[28], vote_average=7.0)
    f.update_profile("u1", 1, "like", 0.01, meta)
    meta2 = MovieMetadata(tmdb_id=2, genre_ids=[28], vote_average=7.0)
    f.update_profile("u1", 2, "like", 0.01, meta2)
    assert f.get_profile("u1").genre_weights[28] == pytest.approx(2.0)


# ---------------------------------------------------------------------------
# update_profile — cast / director / keyword weights
# ---------------------------------------------------------------------------


def test_like_with_cast_populates_actor_weights():
    f = _filter()
    meta = MovieMetadata(tmdb_id=1, genre_ids=[], cast_ids=[500, 501])
    f.update_profile("u1", 1, "like", 0.01, meta)
    profile = f.get_profile("u1")
    assert profile.actor_weights[500] == pytest.approx(1.0)
    assert profile.actor_weights[501] == pytest.approx(1.0)


def test_like_with_director_populates_director_weights():
    f = _filter()
    meta = MovieMetadata(tmdb_id=1, genre_ids=[], director_ids=[999])
    f.update_profile("u1", 1, "like", 0.01, meta)
    assert f.get_profile("u1").director_weights[999] == pytest.approx(1.0)


def test_like_with_keywords_populates_keyword_weights():
    f = _filter()
    meta = MovieMetadata(tmdb_id=1, genre_ids=[], keyword_ids=[10, 20, 30])
    f.update_profile("u1", 1, "like", 0.01, meta)
    profile = f.get_profile("u1")
    assert all(profile.keyword_weights[k] == pytest.approx(1.0) for k in [10, 20, 30])


def test_dislike_does_not_populate_actor_or_keyword_weights():
    f = _filter()
    meta = MovieMetadata(tmdb_id=1, genre_ids=[28], cast_ids=[500], keyword_ids=[10])
    f.update_profile("u1", 1, "dislike", 0.01, meta)
    profile = f.get_profile("u1")
    assert profile.actor_weights == {}
    assert profile.keyword_weights == {}


def test_repeated_likes_accumulate_actor_weights():
    f = _filter()
    meta1 = MovieMetadata(tmdb_id=1, genre_ids=[], cast_ids=[500])
    meta2 = MovieMetadata(tmdb_id=2, genre_ids=[], cast_ids=[500])
    f.update_profile("u1", 1, "like", 0.01, meta1)
    f.update_profile("u1", 2, "like", 0.01, meta2)
    assert f.get_profile("u1").actor_weights[500] == pytest.approx(2.0)
