import { computed, ref, type Ref } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useMovieSelection } from '@/composables/useMovieSelection';
import { useMoviesStore } from '@/stores/movies';
import { watchlistApi } from '@/api';
import { updateListSchema } from '@/lib/schemas';
import { useWatchlistMovies } from '@/composables/watchlist/useWatchlistMovies';
import { useWatchlist } from '@/composables/watchlist/useWatchlist';
import { useWatchlistsStore } from '@/stores/watchlists';
import type { WatchlistMovieResponse } from '@cinemates/shared';

export interface UseEditWatchlistDialogOptions {
  watchlistId: number;
  name: Ref<string>;
  movies?: Ref<WatchlistMovieResponse[] | undefined>;
  editors?: Ref<number[] | undefined>;
}

export function useEditWatchlist(options: UseEditWatchlistDialogOptions) {
  const { watchlistId, name, movies: moviesProp, editors: editorsProp } = options;

  const movieStore = useMoviesStore();
  const { selectedMovies, addMovie, removeMovie, isSelected } = useMovieSelection();

  const { movies: fetchedMovies, refetchMovies } = useWatchlistMovies(watchlistId, {
    immediate: false,
  });
  const { state: watchlist, refetchWatchlist } = useWatchlist(watchlistId, { immediate: false });
  const watchlists = useWatchlistsStore();

  const currentMovies = computed(() => moviesProp?.value ?? fetchedMovies.value);
  const currentEditors = computed(() => editorsProp?.value ?? watchlist.value?.editorIds ?? []);

  const selectedEditors = ref<number[]>([]);

  const { handleSubmit, resetForm, isSubmitting } = useForm({
    validationSchema: toTypedSchema(updateListSchema),
    // Without this the field is undefined until the user types, so "cleared the
    // name" and "did not touch the name" are the same value.
    initialValues: { name: name.value },
  });

  async function init() {
    // The dialog is reused across opens, and reset() clears the form on close.
    resetForm({ values: { name: name.value } });
    if (!moviesProp?.value) {
      await refetchMovies();
    }
    for (const m of currentMovies.value) {
      addMovie(m);
    }
    if (editorsProp?.value) {
      selectedEditors.value = [...editorsProp.value];
    } else {
      await refetchWatchlist();
      selectedEditors.value = [...(watchlist.value?.editorIds ?? [])];
    }
  }

  function reset() {
    selectedMovies.value = [];
    movieStore.resetSearch();
    selectedEditors.value = [];
    resetForm();
  }

  function diffMovies() {
    const toDelete = currentMovies.value.filter(
      (m) => !selectedMovies.value.some((d) => d.id === m.tmdbId),
    );
    const toAdd = selectedMovies.value.filter(
      (m) => !currentMovies.value.some((d) => d.tmdbId === m.id),
    );
    return { toDelete, toAdd };
  }

  function diffEditors() {
    const toDelete = currentEditors.value.filter((id) => !selectedEditors.value.includes(id));
    const toAdd = selectedEditors.value.filter((id) => !currentEditors.value.includes(id));
    return { toDelete, toAdd };
  }

  function saveMovies() {
    const { toDelete, toAdd } = diffMovies();
    return Promise.allSettled([
      ...toDelete.map((m) => watchlistApi.deleteMovie(watchlistId, m.id)),
      ...toAdd.map((m) => watchlistApi.addMovie(watchlistId, { tmdbId: m.id })),
    ]);
  }

  function saveEditors() {
    const { toDelete, toAdd } = diffEditors();
    return Promise.allSettled([
      ...toDelete.map((id) => watchlistApi.deleteUser(watchlistId, id)),
      ...toAdd.map((id) => watchlistApi.addUser(watchlistId, { userId: id, role: 'editor' })),
    ]);
  }

  const submit = handleSubmit(async (values) => {
    // Settled like the other two rather than a bare `await`: a rejected rename
    // would propagate past invalidate(), reporting "Something went wrong" over
    // stale data while the movie changes had already landed.
    const rename =
      values.name && values.name !== name.value
        ? [watchlistApi.update(watchlistId, { name: values.name })]
        : [];

    const [movieResults, editorResults, renameResults] = await Promise.all([
      saveMovies(),
      saveEditors(),
      Promise.allSettled(rename),
    ]);

    const failedCount =
      movieResults.filter((r) => r.status === 'rejected').length +
      editorResults.filter((r) => r.status === 'rejected').length +
      renameResults.filter((r) => r.status === 'rejected').length;

    // The backend excludes the actor from their own events, so nothing else
    // will. Invalidating here covers the overview, the detail page and the
    // movie grid at once, all three watch `version`. Also on a partial
    // failure: whatever did land still has to be shown.
    watchlists.invalidate();

    return { failedCount };
  });

  return {
    selectedMovies,
    addMovie,
    removeMovie,
    isSelected,
    selectedEditors,
    submit,
    isSubmitting,
    init,
    reset,
  };
}
