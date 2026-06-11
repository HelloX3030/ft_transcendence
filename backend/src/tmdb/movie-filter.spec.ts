import { MIN_POPULARITY, filterMovies } from './movie-filter';
import { makeMovie } from './tmdb.fixtures';

describe('filterMovies', () => {
  it('keeps movies with a poster and popularity at or above the threshold', () => {
    const movies = [makeMovie({ id: 1 }), makeMovie({ id: 2 })];

    expect(filterMovies(movies)).toEqual(movies);
  });

  it('drops movies without a poster image', () => {
    const withPoster = makeMovie({ id: 1, poster_path: '/poster.jpg' });
    const withoutPoster = makeMovie({ id: 2, poster_path: null });

    expect(filterMovies([withPoster, withoutPoster])).toEqual([withPoster]);
  });

  it('drops movies below the popularity threshold', () => {
    const popular = makeMovie({ id: 1, popularity: MIN_POPULARITY + 5 });
    const obscure = makeMovie({ id: 2, popularity: MIN_POPULARITY - 5 });

    expect(filterMovies([popular, obscure])).toEqual([popular]);
  });

  it('keeps movies exactly at the popularity threshold', () => {
    const boundary = makeMovie({ id: 1, popularity: MIN_POPULARITY });

    expect(filterMovies([boundary])).toEqual([boundary]);
  });

  it('returns an empty array when every movie is filtered out', () => {
    const junk = [makeMovie({ id: 1, poster_path: null }), makeMovie({ id: 2, popularity: 0 })];

    expect(filterMovies(junk)).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(filterMovies([])).toEqual([]);
  });
});
