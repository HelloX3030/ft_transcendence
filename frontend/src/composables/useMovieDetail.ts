import { ref, watch, type Ref } from 'vue';
import type { TmdbMovieDetail } from '@trailertinder/shared';
import { fetchData } from '@/lib/api';

type DetailStatus = 'idle' | 'loading' | 'ready' | 'notFound' | 'error';

/**
 * Fetches a movie's full detail (credits, trailer, similar) by id, refetching
 * whenever the id changes. Exposes a status so the view can show loading / error
 * / not-found states. Uses a generation token so a slower stale response (id
 * changed mid-flight) is dropped instead of overwriting the current movie.
 */
export function useMovieDetail(movieId: Ref<number | undefined>) {
  const movie = ref<TmdbMovieDetail | null>(null);
  const status = ref<DetailStatus>('idle');

  let generation = 0;

  watch(
    movieId,
    async (id) => {
      const gen = ++generation;
      movie.value = null;
      if (id == null || Number.isNaN(id)) {
        status.value = 'notFound';
        return;
      }
      status.value = 'loading';
      try {
        const data = await fetchData<TmdbMovieDetail>(`/v1/tmdb/movies/${id}`);
        if (gen !== generation) return;
        movie.value = data;
        status.value = 'ready';
      } catch (error) {
        if (gen !== generation) return;
        console.error(error);
        status.value = 'error';
      }
    },
    { immediate: true },
  );

  return { movie, status };
}
