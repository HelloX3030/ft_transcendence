import pytest
import numpy as np

from recommendation.collaborative import CollaborativeFilter
from recommendation.config import RecommenderConfig


def _cf(tmp_path, k: int = 2) -> CollaborativeFilter:
    return CollaborativeFilter(
        model_dir=str(tmp_path),
        config=RecommenderConfig(svd_factors=k),
    )


# A set of interactions large enough for k=2 SVD (needs > 2 users AND > 2 movies).
_INTERACTIONS: list[tuple[str, int, float]] = [
    ("u1", 101, 1.0), ("u1", 102, 1.0), ("u1", 103, -1.0),
    ("u2", 101, 1.0), ("u2", 104, 1.0), ("u2", 103, -1.0),
    ("u3", 102, 1.0), ("u3", 104, 1.0), ("u3", 105, 1.0),
    ("u4", 103, 1.0), ("u4", 105, -1.0),
]


# ---------------------------------------------------------------------------
# No checkpoint — zero fallback
# ---------------------------------------------------------------------------


def test_predict_no_checkpoint_returns_zeros(tmp_path):
    cf = _cf(tmp_path)
    scores = cf.predict("u1", [101, 102, 103])
    assert list(scores) == [0.0, 0.0, 0.0]


def test_predict_empty_candidates_returns_empty(tmp_path):
    cf = _cf(tmp_path)
    scores = cf.predict("u1", [])
    assert scores.shape == (0,)


# ---------------------------------------------------------------------------
# After training
# ---------------------------------------------------------------------------


def test_predict_unknown_user_returns_zeros(tmp_path):
    cf = _cf(tmp_path)
    cf.train(_INTERACTIONS)
    scores = cf.predict("unknown_user", [101, 102])
    assert list(scores) == [0.0, 0.0]


def test_predict_unknown_movie_scores_zero(tmp_path):
    cf = _cf(tmp_path)
    cf.train(_INTERACTIONS)
    scores = cf.predict("u1", [101, 99999])
    assert scores[0] != 0.0   # known movie — non-zero
    assert scores[1] == 0.0   # unknown movie — zero


def test_predict_known_user_and_movie_nonzero(tmp_path):
    cf = _cf(tmp_path)
    cf.train(_INTERACTIONS)
    scores = cf.predict("u1", [101, 102])
    assert scores[0] != 0.0
    assert scores[1] != 0.0


def test_predict_returns_correct_length(tmp_path):
    cf = _cf(tmp_path)
    cf.train(_INTERACTIONS)
    scores = cf.predict("u1", [101, 102, 103, 104])
    assert len(scores) == 4


def test_liked_movies_score_higher_than_disliked(tmp_path):
    cf = _cf(tmp_path)
    cf.train(_INTERACTIONS)
    # u1 liked 101 and 102, disliked 103
    scores = cf.predict("u1", [101, 102, 103])
    assert scores[0] > scores[2]
    assert scores[1] > scores[2]


# ---------------------------------------------------------------------------
# Checkpoint persistence
# ---------------------------------------------------------------------------


def test_checkpoint_persists_across_instances(tmp_path):
    cf1 = _cf(tmp_path)
    cf1.train(_INTERACTIONS)
    score_before = cf1.predict("u1", [101])[0]

    cf2 = _cf(tmp_path)  # fresh instance, loads checkpoint from disk
    score_after = cf2.predict("u1", [101])[0]

    assert score_after == pytest.approx(score_before)


def test_checkpoint_file_is_created(tmp_path):
    cf = _cf(tmp_path)
    cf.train(_INTERACTIONS)
    assert (tmp_path / "svd_checkpoint.joblib").exists()


def test_corrupt_checkpoint_falls_back_to_zeros(tmp_path):
    (tmp_path / "svd_checkpoint.joblib").write_bytes(b"not valid joblib data")
    cf = _cf(tmp_path)
    scores = cf.predict("u1", [101])
    assert scores[0] == 0.0


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_train_empty_interactions_is_noop(tmp_path):
    cf = _cf(tmp_path)
    cf.train([])
    assert cf.predict("u1", [101])[0] == 0.0


def test_train_too_few_users_for_k_is_noop(tmp_path):
    # 1 user, 3 movies → k must be < 1, nothing to decompose
    cf = _cf(tmp_path, k=2)
    cf.train([("u1", 101, 1.0), ("u1", 102, 1.0), ("u1", 103, 1.0)])
    assert cf.predict("u1", [101])[0] == 0.0
