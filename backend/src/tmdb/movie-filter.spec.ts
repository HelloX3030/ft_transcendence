import { MIN_VOTE_AVERAGE, MIN_VOTE_COUNT, filterMovies } from './movie-filter';
import { makeMovie } from './tmdb.fixtures';

describe('filterMovies', () => {
  it('keeps movies with a poster, enough votes, and a rating above the floor', () => {
    const movies = [makeMovie({ id: 1 }), makeMovie({ id: 2 })];

    expect(filterMovies(movies)).toEqual(movies);
  });

  it('drops movies without a poster image', () => {
    const withPoster = makeMovie({ id: 1, poster_path: '/poster.jpg' });
    const withoutPoster = makeMovie({ id: 2, poster_path: null });

    expect(filterMovies([withPoster, withoutPoster])).toEqual([withPoster]);
  });

  it('drops movies below the vote count threshold', () => {
    const established = makeMovie({ id: 1, vote_count: MIN_VOTE_COUNT + 5 });
    const obscure = makeMovie({ id: 2, vote_count: MIN_VOTE_COUNT - 5 });

    expect(filterMovies([established, obscure])).toEqual([established]);
  });

  it('drops movies below the vote average threshold', () => {
    const decent = makeMovie({ id: 1, vote_average: MIN_VOTE_AVERAGE + 1 });
    const panned = makeMovie({ id: 2, vote_average: MIN_VOTE_AVERAGE - 1 });

    expect(filterMovies([decent, panned])).toEqual([decent]);
  });

  it('keeps movies exactly at the thresholds', () => {
    const boundary = makeMovie({
      id: 1,
      vote_count: MIN_VOTE_COUNT,
      vote_average: MIN_VOTE_AVERAGE,
    });

    expect(filterMovies([boundary])).toEqual([boundary]);
  });

  it('returns an empty array when every movie is filtered out', () => {
    const junk = [
      makeMovie({ id: 1, poster_path: null }),
      makeMovie({ id: 2, vote_count: 0 }),
      makeMovie({ id: 3, vote_average: 0 }),
    ];

    expect(filterMovies(junk)).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(filterMovies([])).toEqual([]);
  });
});
