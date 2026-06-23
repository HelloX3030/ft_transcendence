<script setup lang="ts">
<<<<<<< HEAD
import { computed, onMounted } from 'vue';

import { useFetch } from '@/composables/useFetch';
import { useMovieSelection, type Movie } from '@/composables/useMovieSelection';

=======
import MovieSearch from '@/components/MovieSearch.vue';
import MovieBrowser from '@/components/MovieBrowser.vue';
import MovieFilterToggle from '@/components/MovieFilterToggle.vue';
import MovieCard from '@/components/MovieCard.vue';
>>>>>>> main
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import MovieSearch from '@/components/MovieSearch.vue';
import { toast } from 'vue-sonner';
import MovieCard from '@/components/MovieCard.vue';

<<<<<<< HEAD
const { fetchPopular, popularMovies, searchedMovies, isLoading } = useFetch();
const { selectedMovies, addMovie, isSelected } = useMovieSelection();

const movies = computed(() => [...searchedMovies.value, ...popularMovies.value]);

const addFavoriteMovie = (movie: Movie) => {
  if (selectedMovies.value.length >= 10) {
    toast.error('Maximum 10 movies');
    return;
  }
  addMovie(movie);
};
onMounted(fetchPopular);
=======
import { useSelectionStore } from '@/stores/selection';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';

const selection = useSelectionStore();
const { selectedMovies } = storeToRefs(selection);
const auth = useAuthStore();
const router = useRouter();

function completeOnboarding() {
  auth.completeOnboarding();
  router.push('/');
}
>>>>>>> main
</script>

<template>
  <div class="flex flex-col flex-1 p-8 gap-4">
    <div class="">
      <h1 class="text-4xl">Pick your Top 10</h1>
      <p class="text-muted-foreground">
        We'll use these to find your perfect movie trailers and refine your feed.
      </p>
    </div>
    <MovieSearch />
    <MovieFilterToggle />
    <Button :disabled="selectedMovies.length < 10" @click="completeOnboarding">Next</Button>
    <div class="flex items-center justify-between">
      <span>Selected({{ selectedMovies.length }}/10)</span>
      <Progress :model-value="selectedMovies.length * 10" class="w-1/3" />
    </div>

<<<<<<< HEAD
    <div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
      <MovieCard
        v-for="movie in movies"
        :key="movie.id"
        :title="movie.title"
        :img="movie.poster_path"
        :selected="isSelected(movie.id)"
        @select="addFavoriteMovie({ title: movie.title, id: movie.id, img: movie.poster_path })"
        :loading="isLoading === 'loading'"
      />
    </div>
=======
    <MovieBrowser :show-label="false">
      <template #movie="{ movie }">
        <MovieCard
          :title="movie.title"
          :img="movie.poster_path"
          :selected="selection.isSelected(movie.id)"
          @select="selection.toggleMovie(movie)"
        />
      </template>
    </MovieBrowser>
>>>>>>> main
  </div>
</template>
