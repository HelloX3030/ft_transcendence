import { TmdbMovieDetail } from '@cinemates/shared';
import { derivePreferences, OnboardingLimits } from './onboarding-preferences';

const ALL: OnboardingLimits = { genres: 10, actors: 10, directors: 10 };

interface MovieSpec {
  genres?: number[];
  /** Billing order, the derivation only counts the first five. */
  cast?: number[];
  crew?: { id: number; job: string }[];
}

function movie({ genres = [], cast = [], crew = [] }: MovieSpec): TmdbMovieDetail {
  return {
    id: 1,
    title: 'Movie',
    original_title: 'Movie',
    overview: '',
    poster_path: null,
    backdrop_path: null,
    release_date: '2024-01-01',
    vote_average: 7,
    vote_count: 100,
    popularity: 1,
    original_language: 'en',
    adult: false,
    video: false,
    genres: genres.map((id) => ({ id, name: `Genre ${id}` })),
    runtime: 120,
    tagline: '',
    credits: {
      cast: cast.map((id) => ({ id, name: `Actor ${id}`, character: '', profile_path: null })),
      crew: crew.map(({ id, job }) => ({
        id,
        name: `Crew ${id}`,
        job,
        department: job === 'Director' ? 'Directing' : 'Production',
        profile_path: null,
      })),
    },
    trailerKey: 'key',
    similar: [],
  };
}

describe('derivePreferences', () => {
  describe('genres', () => {
    it('ranks by how often they appear across the picks', () => {
      const { genreIds } = derivePreferences(
        [movie({ genres: [18, 28] }), movie({ genres: [28] }), movie({ genres: [28, 12] })],
        ALL,
      );

      expect(genreIds).toEqual([28, 12, 18]);
    });

    // Order is precedence: the recommender gives every onboarding id the same
    // weight and takes a fixed slice with a stable sort, so an unstable order
    // here would change which genres reach its query.
    it('breaks a tie by ascending id, not by encounter order', () => {
      const { genreIds } = derivePreferences([movie({ genres: [878, 12] })], ALL);

      expect(genreIds).toEqual([12, 878]);
    });

    it('keeps a genre that appears only once', () => {
      const { genreIds } = derivePreferences([movie({ genres: [99] })], ALL);

      expect(genreIds).toEqual([99]);
    });
  });

  describe('actors', () => {
    it('counts only the top-billed cast', () => {
      // Actor 6 is billed sixth in both films, so it never counts despite recurring.
      const picks = [movie({ cast: [1, 2, 3, 4, 5, 6] }), movie({ cast: [1, 2, 3, 4, 5, 6] })];

      const { actorIds } = derivePreferences(picks, ALL);

      expect(actorIds).toEqual([1, 2, 3, 4, 5]);
      expect(actorIds).not.toContain(6);
    });

    // Across ten films most actors appear once, an artefact of picking a film,
    // not a preference.
    it('drops an actor who appears in only one film', () => {
      const { actorIds } = derivePreferences([movie({ cast: [7] }), movie({ cast: [8] })], ALL);

      expect(actorIds).toEqual([]);
    });

    it('keeps an actor who appears in two', () => {
      const { actorIds } = derivePreferences([movie({ cast: [7] }), movie({ cast: [7] })], ALL);

      expect(actorIds).toEqual([7]);
    });
  });

  describe('directors', () => {
    it('ignores crew who are not directors', () => {
      const picks = [
        movie({
          crew: [
            { id: 1, job: 'Director' },
            { id: 2, job: 'Producer' },
          ],
        }),
        movie({
          crew: [
            { id: 1, job: 'Director' },
            { id: 2, job: 'Producer' },
          ],
        }),
      ];

      const { directorIds } = derivePreferences(picks, ALL);

      expect(directorIds).toEqual([1]);
    });

    it('credits both directors of a co-directed film', () => {
      const coDirected = movie({
        crew: [
          { id: 1, job: 'Director' },
          { id: 2, job: 'Director' },
        ],
      });

      const { directorIds } = derivePreferences([coDirected, coDirected], ALL);

      expect(directorIds).toEqual([1, 2]);
    });

    it('drops a director who appears in only one film', () => {
      const { directorIds } = derivePreferences(
        [movie({ crew: [{ id: 9, job: 'Director' }] })],
        ALL,
      );

      expect(directorIds).toEqual([]);
    });
  });

  it('counts a person credited twice on the same film once', () => {
    // Credited as director and as writer on the same film, one pick, not two,
    // so the recurrence threshold is not satisfied by a single movie.
    const doubleCredited = movie({
      crew: [
        { id: 5, job: 'Director' },
        { id: 5, job: 'Director' },
      ],
    });

    const { directorIds } = derivePreferences([doubleCredited], ALL);

    expect(directorIds).toEqual([]);
  });

  describe('limits', () => {
    it('truncates each list', () => {
      const picks = [
        movie({ genres: [1, 2, 3, 4], cast: [1, 2], crew: [{ id: 1, job: 'Director' }] }),
        movie({ genres: [1, 2, 3, 4], cast: [1, 2], crew: [{ id: 1, job: 'Director' }] }),
      ];

      const result = derivePreferences(picks, { genres: 2, actors: 1, directors: 1 });

      expect(result.genreIds).toHaveLength(2);
      expect(result.actorIds).toHaveLength(1);
      expect(result.directorIds).toHaveLength(1);
    });

    // The shipped configuration: the derivation still counts every dimension,
    // and the limit alone decides how much is handed over.
    it('yields an empty array for a limit of zero, without affecting the others', () => {
      const picks = [
        movie({ genres: [28], cast: [1], crew: [{ id: 1, job: 'Director' }] }),
        movie({ genres: [28], cast: [1], crew: [{ id: 1, job: 'Director' }] }),
      ];

      const result = derivePreferences(picks, { genres: 5, actors: 0, directors: 0 });

      expect(result.genreIds).toEqual([28]);
      expect(result.actorIds).toEqual([]);
      expect(result.directorIds).toEqual([]);
    });
  });

  it('handles an empty pick list without throwing', () => {
    expect(derivePreferences([], ALL)).toEqual({ genreIds: [], actorIds: [], directorIds: [] });
  });

  // The ten films in OnboardingDto's own example, with their real TMDB genres,
  // top-five billing and directors. Frozen so the derived profile stays true.
  it('derives the documented profile from the reference picks', () => {
    const director = (id: number) => [{ id, job: 'Director' }];
    const picks = [
      // Inception
      movie({ genres: [28, 878, 12], cast: [6193, 24045, 3899, 2524, 27578], crew: director(525) }),
      // Interstellar
      movie({ genres: [12, 18, 878], cast: [10297, 1813, 3895, 83002, 1893], crew: director(525) }),
      // The Avengers
      movie({
        genres: [878, 28, 12],
        cast: [3223, 16828, 103, 74568, 1245],
        crew: director(12891),
      }),
      // The Dark Knight
      movie({ genres: [28, 80, 53], cast: [3894, 1810, 6383, 3895, 1579], crew: director(525) }),
      // Fight Club
      movie({ genres: [18, 53], cast: [819, 287, 1283, 7470, 7499], crew: director(7467) }),
      // Pulp Fiction
      movie({ genres: [53, 80, 35], cast: [8891, 2231, 139, 62, 10182], crew: director(138) }),
      // Forrest Gump
      movie({ genres: [35, 18, 10749], cast: [31, 32, 33, 35, 34], crew: director(24) }),
      // The Lord of the Rings: The Fellowship of the Ring
      movie({ genres: [12, 14, 28], cast: [109, 1327, 110, 1328, 65], crew: director(108) }),
      // The Lord of the Rings: The Return of the King
      movie({ genres: [12, 14, 28], cast: [109, 1327, 110, 1328, 1333], crew: director(108) }),
      // Titanic
      movie({ genres: [18, 10749], cast: [6193, 204, 1954, 8534, 3713], crew: director(2710) }),
    ];

    const result = derivePreferences(picks, { genres: 5, actors: 4, directors: 3 });

    // Adventure:5 and Action:5 tie and break on id, then Drama:4, then Thriller:3
    // and Sci-Fi:3 tie and break on id. The recommender AND-joins the first three.
    expect(result.genreIds).toEqual([12, 28, 18, 53, 878]);
    // Nolan three times, Jackson twice; nobody else directs more than one pick.
    expect(result.directorIds).toEqual([525, 108]);
    // Six people appear in two films, the four LOTR leads plus DiCaprio (6193,
    // Inception and Titanic) and Caine (3895, Interstellar and The Dark Knight).
    // All six tie at 2, so the limit of 4 takes the lowest ids.
    expect(result.actorIds).toEqual([109, 110, 1327, 1328]);
  });
});
