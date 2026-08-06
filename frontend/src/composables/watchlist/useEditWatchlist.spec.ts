import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

const update = vi.fn();
const invalidate = vi.fn();

/** Stands in for vee-validate so the submitted values can be driven directly.
 *  What the real one does with an invalid form is covered by the schema specs;
 *  what is under test here is the accounting inside the handler. */
let submittedValues: { name?: string } = {};

vi.mock('vee-validate', () => ({
  useForm: () => ({
    handleSubmit:
      (handler: (values: { name?: string }) => Promise<{ failedCount: number }>) => () =>
        handler(submittedValues),
    resetForm: vi.fn(),
    isSubmitting: ref(false),
  }),
}));
vi.mock('@vee-validate/zod', () => ({ toTypedSchema: (schema: unknown) => schema }));
vi.mock('@/api', () => ({
  watchlistApi: {
    update: (...args: unknown[]) => update(...args),
    addMovie: vi.fn(),
    deleteMovie: vi.fn(),
    addUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}));
vi.mock('@/stores/movies', () => ({ useMoviesStore: () => ({ resetSearch: vi.fn() }) }));
vi.mock('@/stores/watchlists', () => ({ useWatchlistsStore: () => ({ invalidate }) }));
vi.mock('@/composables/watchlist/useWatchlistMovies', () => ({
  useWatchlistMovies: () => ({ movies: ref([]), refetchMovies: vi.fn() }),
}));
vi.mock('@/composables/watchlist/useWatchlist', () => ({
  useWatchlist: () => ({ state: ref(undefined), refetchWatchlist: vi.fn() }),
}));

const { useEditWatchlist } = await import('./useEditWatchlist');

function setup(currentName: string) {
  return useEditWatchlist({
    watchlistId: 7,
    name: ref(currentName),
    movies: ref([]),
    editors: ref([]),
  });
}

describe('useEditWatchlist — the rename', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    update.mockResolvedValue(undefined);
    submittedValues = {};
  });

  it('does not send an update when the name is unchanged', async () => {
    submittedValues = { name: 'My List' };

    const result = await setup('My List').submit();

    expect(update).not.toHaveBeenCalled();
    expect(result?.failedCount).toBe(0);
  });

  it('sends the update when the name changed', async () => {
    submittedValues = { name: 'Renamed' };

    const result = await setup('My List').submit();

    expect(update).toHaveBeenCalledWith(7, { name: 'Renamed' });
    expect(result?.failedCount).toBe(0);
  });

  // Previously a bare `await`, so a 403 on a read-only list propagated past
  // invalidate() — "Something went wrong" over stale data, while the movie
  // changes had already landed on the server.
  it('counts a failed rename and still invalidates', async () => {
    update.mockRejectedValue(new Error('read-only list'));
    submittedValues = { name: 'Renamed' };

    const result = await setup('My List').submit();

    expect(result?.failedCount).toBe(1);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
