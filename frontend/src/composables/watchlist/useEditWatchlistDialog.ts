// composables/watchlist/useEditWatchlistDialog.ts
import { computed, ref, watch, type Ref } from 'vue';
import { toast } from 'vue-sonner';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useMovieSelection } from '@/composables/useMovieSelection';
import { useMoviesStore } from '@/stores/movies';
import { watchlistApi } from '@/api';
import { updateListSchema } from '@/lib/schemas';
import { useWatchlistMovies } from '@/composables/watchlist/useWatchlistMovies';
import { useWatchlist } from '@/composables/watchlist/useWatchlist';
import type { WatchlistMovieResponse } from '@trailertinder/shared';

export interface UseEditWatchlistDialogOptions {
  watchlistId: number;
  name: Ref<string>;
  isOpen: Ref<boolean | undefined>;
  movies?: Ref<WatchlistMovieResponse[] | undefined>;
  editors?: Ref<number[] | undefined>;
  onSuccess?: () => void;
}

export function useEditWatchlistDialog(options: UseEditWatchlistDialogOptions) {
  const {
    watchlistId,
    name,
    isOpen,
    movies: moviesProp,
    editors: editorsProp,
    onSuccess,
  } = options;

  const movieStore = useMoviesStore();
  const { selectedMovies, addMovie, removeMovie, isSelected } = useMovieSelection();

  const { movies: fetchedMovies, refetchMovies } = useWatchlistMovies(watchlistId, {
    immediate: false,
  });
  const { state: watchlist, refetchWatchlist } = useWatchlist(watchlistId, { immediate: false });

  const currentMovies = computed(() => moviesProp?.value ?? fetchedMovies.value);
  const currentEditors = computed(() => editorsProp?.value ?? watchlist.value?.editorIds ?? []);

  const selectedEditors = ref<number[]>([]);

  const { handleSubmit, resetForm } = useForm({
    validationSchema: toTypedSchema(updateListSchema),
  });

  // --- Lifecycle: Dialog auf/zu ---

  watch(isOpen, async (open) => {
    if (open) {
      await initDialog();
    } else {
      resetDialog();
    }
  });

  const initDialog = async () => {
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
  };

  const resetDialog = () => {
    selectedMovies.value = [];
    movieStore.resetSearch();
    selectedEditors.value = [];
    resetForm();
  };

  // --- Diffing ---

  const diffMovies = () => {
    const toDelete = currentMovies.value.filter(
      (m) => !selectedMovies.value.some((d) => d.id === m.tmdbId),
    );
    const toAdd = selectedMovies.value.filter(
      (m) => !currentMovies.value.some((d) => d.tmdbId === m.id),
    );
    return { toDelete, toAdd };
  };

  const diffEditors = () => {
    const toDelete = currentEditors.value.filter((id) => !selectedEditors.value.includes(id));
    const toAdd = selectedEditors.value.filter((id) => !currentEditors.value.includes(id));
    return { toDelete, toAdd };
  };

  // --- Persistieren ---

  const saveMovies = () => {
    const { toDelete, toAdd } = diffMovies();
    return Promise.allSettled([
      ...toDelete.map((m) => watchlistApi.deleteMovie(watchlistId, m.id)),
      ...toAdd.map((m) => watchlistApi.addMovie(watchlistId, { tmdbId: m.id })),
    ]);
  };

  const saveEditors = () => {
    const { toDelete, toAdd } = diffEditors();
    return Promise.allSettled([
      ...toDelete.map((id) => watchlistApi.deleteUser(watchlistId, id)),
      ...toAdd.map((id) => watchlistApi.addUser(watchlistId, { userId: id, role: 'editor' })),
    ]);
  };

  // --- Submit ---

  const submit = handleSubmit(async (values) => {
    try {
      const [movieResults, editorResults] = await Promise.all([saveMovies(), saveEditors()]);

      const failedCount =
        movieResults.filter((r) => r.status === 'rejected').length +
        editorResults.filter((r) => r.status === 'rejected').length;

      if (failedCount > 0) {
        toast.error(`${failedCount} action(s) failed`);
      }

      if (values.name && values.name !== name.value) {
        await watchlistApi.update(watchlistId, { name: values.name });
      }

      if (failedCount === 0) {
        toast.success('Edit Successfully');
      }

      onSuccess?.();
    } catch (error) {
      console.log(error);
      toast.error('Something went wrong');
    }

    isOpen.value = false;
  });

  return {
    // movies
    selectedMovies,
    addMovie,
    removeMovie,
    isSelected,
    // editors
    selectedEditors,
    // form
    submit,
  };
}
