import { ref } from 'vue';

export interface Movie {
  id: number;
  title: string;
  img: string;
} //TODO: Richtigen Type erstellen

export function useMovieSelection() {
  const selectedMovies = ref<Movie[]>([]);

  const addMovie = (movie: Movie) => {
    if (selectedMovies.value.some((m) => m.id === movie.id)) {
      removeMovie(movie.id);
      return;
    }

    selectedMovies.value.push(movie);
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
