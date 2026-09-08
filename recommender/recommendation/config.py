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

    # --- TMDB parameter translation (profile -> Discover query) ---
    tmdb_top_genres: int = 3            # genres sent as with_genres (OR-joined)
    tmdb_top_keywords: int = 5          # keywords sent as with_keywords (OR-joined)
    tmdb_top_cast: int = 2              # actors sent as with_cast (OR-joined)
    tmdb_top_crew: int = 1              # directors sent as with_crew
    tmdb_min_person_weight: float = 0.5 # cast/crew below this weight are omitted (weak signal)
    tmdb_min_vote_count: int = 100      # vote_count.gte floor on Discover results
    tmdb_page_window: int = 5           # daily page rotation: base page in [1, window]
    tmdb_facet_pages: int = 1           # pages fetched per cast/crew/keyword facet query
    tmdb_vote_margin: float = 1.0       # vote_average.gte sits this far below the profile average
    # Cycled by cursor. Paging alone still walks one ordering of the same
    # popularity ranking; changing the ordering surfaces genuinely other films.
    tmdb_sort_cycle: tuple[str, ...] = (
        "popularity.desc",
        "vote_average.desc",
        "primary_release_date.desc",
        "revenue.desc",
    )

    # --- Engagement signal deltas (additive on top of hybrid score) ---
    signal_like: float = 0.20
    signal_dislike: float = -0.40
    signal_watchlist_add: float = 0.50
    signal_skip_fast: float = -0.50
    signal_watched_long: float = 0.30
    signal_rewatch: float = 0.60
    signal_share: float = 0.60


DEFAULT_CONFIG = RecommenderConfig()
