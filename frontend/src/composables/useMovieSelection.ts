import type { TmdbMovie, WatchlistMovieResponse } from '@cinemates/shared';
import { ref } from 'vue';

interface SelectedMovie {
  id: number; // tmdbId
  title: string;
  poster_path: string | null;
}

export function useMovieSelection() {
  const selectedMovies = ref<SelectedMovie[]>([]);

  const addMovie = (movie: TmdbMovie | WatchlistMovieResponse) => {
    const tmdbId = 'tmdbId' in movie ? movie.tmdbId : movie.id;

    if (selectedMovies.value.some((m) => m.id === tmdbId)) {
      removeMovie(tmdbId);
      return;
    }

    selectedMovies.value.push({
      id: tmdbId,
      title: 'title' in movie ? movie.title : movie.name,
      poster_path: 'poster_path' in movie ? movie.poster_path : movie.posterPath,
    });
  };

  const removeMovie = (id: number) => {
    selectedMovies.value = selectedMovies.value.filter((m) => m.id !== id);
  };

  const isSelected = (id: number) => {
    return selectedMovies.value.some((item) => item.id === id);
  };

  const clear = () => {
    selectedMovies.value = [];
  };

  return {
    selectedMovies,
    addMovie,
    removeMovie,
    isSelected,
    clear,
  };
}
