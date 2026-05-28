import { options, popular } from '@/lib/test';
import { ref } from 'vue';

const popularMovies = ref<typeof popular>([]);
const searchedMovies = ref<typeof popular>([]);
const isLoading = ref<'loading' | 'pending' | 'finish' | 'error'>('pending');

export function useFetch() {
  async function fetchPopular() {
    try {
      isLoading.value = 'loading';
      // await new Promise((resolve) => setTimeout(resolve, 3000));

      const res = await fetch(
        'https://api.themoviedb.org/3/movie/popular?language=en-US&page=1',
        options,
      );

      const data = await res.json();
      isLoading.value = 'finish';
      console.log(data.results);
      popularMovies.value = data.results;
    } catch (error) {
      console.error(error);
      isLoading.value = 'error';
    }
  }

  async function searchMovies(inputQuery: string) {
    try {
      isLoading.value = 'loading';
      // await new Promise((resolve) => setTimeout(resolve, 3000));
      console.log(inputQuery);
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?query=${inputQuery}&include_adult=false&language=en-US&page=1`,
        options,
      );
      const data = await res.json();
      isLoading.value = 'finish';
      console.log(data.results);
      searchedMovies.value = data.results;
    } catch (error) {
      console.error(error);
      isLoading.value = 'error';
    }
  }

  return { fetchPopular, searchMovies, popularMovies, searchedMovies, isLoading };
}
