import { ref } from 'vue';

const selectedMovies = ref<{ title: string; img: string | null; id: number }[]>([]);

export function useMovies() {
  function addMovie({
    title,
    poster_path,
    id,
  }: {
    title: string;
    poster_path: string | null;
    id: number;
  }) {
    const idx = selectedMovies.value.findIndex((item) => item.id === id);
    if (idx !== -1) selectedMovies.value.splice(idx, 1);
    else if (selectedMovies.value.length < 10)
      selectedMovies.value.push({ title, img: poster_path, id });
  }

  return { selectedMovies, addMovie };
}
