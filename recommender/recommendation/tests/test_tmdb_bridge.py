from datetime import date

from recommendation.config import RecommenderConfig
from recommendation.content_based import UserProfile
from recommendation.tmdb_bridge import profile_to_params, profile_to_query_plan

CFG = RecommenderConfig()
TODAY = date(2026, 6, 11)


def _warm_profile() -> UserProfile:
    return UserProfile(
        user_id="u1",
        interaction_count=25,
        genre_weights={28: 3.0, 12: 2.5, 35: 1.2, 18: 0.4},
        actor_weights={6193: 2.0, 500: 0.3},
        director_weights={525: 1.4},
        keyword_weights={4565: 0.9, 1701: 0.8, 818: 0.7, 9715: 0.6, 4344: 0.5, 7777: 0.1},
        avg_vote=6.54,
    )


def test_cold_start_empty_profile_has_baseline_params_only():
    params = profile_to_params(UserProfile(user_id="new"), today=TODAY)

    assert params["sort_by"] == "popularity.desc"
    assert params["vote_count.gte"] == CFG.tmdb_min_vote_count
    assert 1 <= params["page"] <= CFG.tmdb_page_window
    for key in ("with_genres", "with_keywords", "with_cast", "with_crew", "vote_average.gte"):
        assert key not in params


def test_cold_start_with_onboarding_genres_emits_with_genres():
    profile = UserProfile(user_id="new", genre_weights={28: 1.0, 12: 1.0})
    params = profile_to_params(profile, today=TODAY)

    assert params["with_genres"] == "28|12"
    assert params["sort_by"] == "popularity.desc"
    assert "vote_average.gte" not in params  # no liked films yet


def test_warm_profile_core_query_is_genres_and_vote_floors_only():
    params = profile_to_params(_warm_profile(), today=TODAY)

    # Top-3 genres by weight, OR-joined, strongest first. AND-joining these
    # was issue #247: no film carries all three at once.
    assert params["with_genres"] == "28|12|35"
    # Vote floor sits tmdb_vote_margin below the profile average, not on it.
    assert params["vote_average.gte"] == 5.5
    # Cast/crew/keywords are facet queries now, not extra constraints here.
    for key in ("with_cast", "with_crew", "with_keywords"):
        assert key not in params


def test_diversify_drops_dominant_genre_and_refills():
    params = profile_to_params(_warm_profile(), diversify=True, today=TODAY)

    # Dominant genre 28 removed; the next three move up.
    assert params["with_genres"] == "12|35|18"


def test_negative_weights_never_qualify():
    profile = UserProfile(user_id="u2", genre_weights={28: -2.0, 12: 0.8})
    params = profile_to_params(profile, today=TODAY)

    assert params["with_genres"] == "12"


def test_weak_person_signals_are_omitted():
    profile = UserProfile(user_id="u3", actor_weights={6193: 0.2}, director_weights={525: 0.1})
    params = profile_to_params(profile, today=TODAY)

    assert "with_cast" not in params
    assert "with_crew" not in params


def test_page_rotation_is_deterministic_and_in_window():
    profile = UserProfile(user_id="u4")

    first = profile_to_params(profile, today=TODAY)["page"]
    second = profile_to_params(profile, today=TODAY)["page"]
    assert first == second
    assert 1 <= first <= CFG.tmdb_page_window

    pages = {
        profile_to_params(profile, today=date(2026, 6, day))["page"] for day in range(1, 11)
    }
    assert len(pages) > 1  # the window actually shifts across days


def test_page_rotation_varies_across_users():
    pages = {
        profile_to_params(UserProfile(user_id=f"user-{i}"), today=TODAY)["page"]
        for i in range(20)
    }
    assert len(pages) > 1


def test_query_plan_fans_out_one_query_per_dimension():
    plan = profile_to_query_plan(_warm_profile(), today=TODAY)

    # Core first, then one query per dimension the profile has a signal for.
    assert len(plan) == 4
    assert plan[0]["with_genres"] == "28|12|35"

    # Each facet constrains on its own dimension and nothing else, so it
    # widens the pool rather than intersecting it with the core query.
    cast, crew, keywords = plan[1], plan[2], plan[3]
    assert cast["with_cast"] == "6193"          # actor 500 is below the weight floor
    assert crew["with_crew"] == "525"
    assert keywords["with_keywords"] == "4565|1701|818|9715|4344"  # 7777 cut by the cap

    for facet in (cast, crew, keywords):
        assert "with_genres" not in facet
        assert "vote_average.gte" not in facet
        assert facet["vote_count.gte"] == CFG.tmdb_min_vote_count


def test_query_plan_for_cold_start_is_core_only():
    plan = profile_to_query_plan(UserProfile(user_id="new"), today=TODAY)

    assert len(plan) == 1
    assert "with_genres" not in plan[0]


def test_query_plan_omits_facets_with_no_qualifying_signal():
    profile = UserProfile(
        user_id="u5",
        genre_weights={28: 2.0},
        actor_weights={6193: 0.2},      # below tmdb_min_person_weight
        keyword_weights={4565: 0.9},
    )
    plan = profile_to_query_plan(profile, today=TODAY)

    assert len(plan) == 2
    assert plan[1]["with_keywords"] == "4565"


def test_vote_floor_never_goes_negative():
    profile = UserProfile(user_id="u6", avg_vote=0.4)
    params = profile_to_params(profile, today=TODAY)

    assert params["vote_average.gte"] == 0.0


# ---------------------------------------------------------------------------
# Cursor rotation (issue #249): repeated /feed calls must move forward
# ---------------------------------------------------------------------------


def test_cursor_advances_the_page_by_a_full_fetch_width():
    profile = UserProfile(user_id="u7", genre_weights={28: 2.0})

    first = profile_to_params(profile, today=TODAY, cursor=0)["page"]
    second = profile_to_params(profile, today=TODAY, cursor=1)["page"]

    # A full width, so the second call's pages do not overlap the first call's.
    assert second == first + CFG.tmdb_pages


def test_cursor_cycles_the_sort_order():
    profile = UserProfile(user_id="u8", genre_weights={28: 2.0})

    sorts = [
        profile_to_params(profile, today=TODAY, cursor=c)["sort_by"]
        for c in range(len(CFG.tmdb_sort_cycle))
    ]

    assert sorts == list(CFG.tmdb_sort_cycle)
    # And it wraps rather than running off the end.
    assert profile_to_params(profile, today=TODAY, cursor=len(CFG.tmdb_sort_cycle))["sort_by"] == CFG.tmdb_sort_cycle[0]


def test_cursor_zero_matches_the_uncursored_call():
    profile = UserProfile(user_id="u9", genre_weights={28: 2.0})

    assert profile_to_params(profile, today=TODAY) == profile_to_params(
        profile, today=TODAY, cursor=0
    )


def test_page_never_exceeds_the_tmdb_ceiling():
    profile = UserProfile(user_id="u10", genre_weights={28: 2.0})

    assert profile_to_params(profile, today=TODAY, cursor=10_000)["page"] == 500


def test_plan_facets_share_the_cursors_page_and_sort():
    plan = profile_to_query_plan(_warm_profile(), today=TODAY, cursor=2)
    core = plan[0]

    for facet in plan[1:]:
        assert facet["page"] == core["page"]
        assert facet["sort_by"] == core["sort_by"]


def test_successive_cursors_never_repeat_a_page_window():
    profile = UserProfile(user_id="u11", genre_weights={28: 2.0})

    windows = []
    for cursor in range(5):
        start = profile_to_params(profile, today=TODAY, cursor=cursor)["page"]
        windows += list(range(start, start + CFG.tmdb_pages))

    assert len(windows) == len(set(windows))
