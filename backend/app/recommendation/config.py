from dataclasses import dataclass


@dataclass(frozen=True)
class RecommenderConfig:
    # --- Blend weights ---
    alpha: float = 0.6          # content vs. collaborative  (1.0 = content only)
    beta: float = 0.7           # feature vector vs. overview TF-IDF

    # --- Diversification & freshness ---
    gamma: float = 0.15         # flat score boost applied to diversified candidates
    delta: float = 0.1          # weight of the freshness term in the final score

    # --- Decay rates (per day) ---
    lambda_decay: float = 0.01  # exponential decay on user-profile interaction weights
    mu_decay: float = 0.05      # exponential decay on movie freshness

    # --- Collaborative filtering ---
    svd_factors: int = 50       # number of latent factors k for SVD

    # --- Cold-start thresholds ---
    hybrid_threshold: int = 10  # interactions needed before CF contributes to the score

    # --- TMDB candidate pool ---
    tmdb_pages: int = 3         # TMDB Discover pages fetched per feed request
    min_pool_ratio: int = 2     # trigger a refetch when pool size < limit * this


DEFAULT_CONFIG = RecommenderConfig()
