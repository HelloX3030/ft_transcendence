import os
from pathlib import Path

import joblib
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import svds

from .config import DEFAULT_CONFIG, RecommenderConfig

_CHECKPOINT_FILE = "svd_checkpoint.joblib"
_TEMP_SUFFIX = ".tmp"


class CollaborativeFilter:
    """
    SVD-based collaborative filtering.

    On init: loads a pre-trained checkpoint from disk; returns zeros until one exists.
    On train(): fits SVD on fresh interaction rows and atomically replaces the checkpoint
    so the live predict() path is never interrupted.

    The checkpoint stores U_k·Σ_k^½ and V_k·Σ_k^½ pre-multiplied, so predict() is a
    single dot product at call time, with no decomposition at runtime.
    """

    def __init__(
        self,
        model_dir: str = "./models",
        config: RecommenderConfig = DEFAULT_CONFIG,
    ) -> None:
        self._cfg = config
        self._checkpoint_path = Path(model_dir) / _CHECKPOINT_FILE

        # shape (n_users, k), U_k · Σ_k^½
        self._user_factors: np.ndarray | None = None
        # shape (n_movies, k), V_k · Σ_k^½
        self._movie_factors: np.ndarray | None = None

        self._user_index: dict[str, int] = {}
        self._movie_index: dict[int, int] = {}

        self._load_checkpoint()

    def predict(self, user_id: str, candidate_ids: list[int]) -> np.ndarray:
        """
        Return a score per candidate. Zero for unknown users, unknown movies,
        or when no checkpoint has been trained yet.
        """
        n = len(candidate_ids)
        if self._user_factors is None or user_id not in self._user_index:
            return np.zeros(n)

        u = self._user_factors[self._user_index[user_id]]
        scores = np.zeros(n)
        for i, mid in enumerate(candidate_ids):
            if mid in self._movie_index:
                scores[i] = float(u @ self._movie_factors[self._movie_index[mid]])
        return scores

    def train(self, interactions: list[tuple[str, int, float]]) -> None:
        """
        Fit SVD and atomically replace the on-disk checkpoint.

        Args:
            interactions: (user_id, tmdb_id, rating) rows.
                          rating +1 = positive interaction, -1 = dislike.

        Called by retrain.py nightly. Safe while the service is live: the swap
        is atomic and predict() keeps the old factors until _load_checkpoint()
        runs again.
        """
        if not interactions:
            return

        user_ids = sorted({r[0] for r in interactions})
        movie_ids = sorted({r[1] for r in interactions})
        user_index = {uid: i for i, uid in enumerate(user_ids)}
        movie_index = {mid: i for i, mid in enumerate(movie_ids)}

        rows = [user_index[r[0]] for r in interactions]
        cols = [movie_index[r[1]] for r in interactions]
        data = [float(r[2]) for r in interactions]

        R = csr_matrix(
            (data, (rows, cols)),
            shape=(len(user_ids), len(movie_ids)),
            dtype=np.float32,
        )

        # svds requires k < min(n_rows, n_cols).
        k = min(self._cfg.svd_factors, R.shape[0] - 1, R.shape[1] - 1)
        if k < 1:
            return

        U, sigma, Vt = svds(R, k=k)
        sqrt_sigma = np.sqrt(sigma)

        # Pre-multiply: predict() becomes user_factors[u] @ movie_factors[m].
        user_factors = U * sqrt_sigma                    # (n_users, k)
        movie_factors = (Vt * sqrt_sigma[:, None]).T    # (n_movies, k)

        checkpoint = {
            "user_factors": user_factors,
            "movie_factors": movie_factors,
            "user_index": user_index,
            "movie_index": movie_index,
        }
        self._save_checkpoint(checkpoint)
        self._apply_checkpoint(checkpoint)

    def _load_checkpoint(self) -> None:
        if not self._checkpoint_path.exists():
            return
        try:
            self._apply_checkpoint(joblib.load(self._checkpoint_path))
        except Exception:
            # Corrupt or incompatible checkpoint, service starts with zero scores.
            pass

    def _save_checkpoint(self, checkpoint: dict) -> None:
        self._checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._checkpoint_path.with_suffix(_TEMP_SUFFIX)
        joblib.dump(checkpoint, tmp)
        os.replace(tmp, self._checkpoint_path)  # atomic on POSIX

    def _apply_checkpoint(self, checkpoint: dict) -> None:
        self._user_factors = checkpoint["user_factors"]
        self._movie_factors = checkpoint["movie_factors"]
        self._user_index = checkpoint["user_index"]
        self._movie_index = checkpoint["movie_index"]
