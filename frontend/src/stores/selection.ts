import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { TmdbMovie } from '@trailertinder/shared';

export interface SelectedMovie {
  id: number;
  title: string;
  img: string | null;
}

// Max movies a user can pick during onboarding.
export const MAX_SELECTED = 10;

export const useSelectionStore = defineStore('selection', () => {
  const selectedMovies = ref<SelectedMovie[]>([]);

  function isSelected(id: number): boolean {
    return selectedMovies.value.some((movie) => movie.id === id);
  }

  // Toggles a movie in the selection: removes it if already picked, otherwise
  // adds it while under the cap.
  function toggleMovie(movie: Pick<TmdbMovie, 'id' | 'title' | 'poster_path'>) {
    const idx = selectedMovies.value.findIndex((item) => item.id === movie.id);
    if (idx !== -1) {
      selectedMovies.value.splice(idx, 1);
    } else if (selectedMovies.value.length < MAX_SELECTED) {
      selectedMovies.value.push({ id: movie.id, title: movie.title, img: movie.poster_path });
    }
  }

  return { selectedMovies, isSelected, toggleMovie };
});
