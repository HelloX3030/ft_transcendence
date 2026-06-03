<script setup lang="ts">
import { computed, onMounted } from 'vue';

import { useFetch } from '@/composables/useFetch';
import { useMovieSelection, type Movie } from '@/composables/useMovieSelection';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import MovieSearch from '@/components/MovieSearch.vue';
import { toast } from 'vue-sonner';
import MovieCard from '@/components/MovieCard.vue';

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
    <Button :disabled="selectedMovies.length < 10">Next</Button>
    <div class="flex items-center justify-between">
      <span>Selected({{ selectedMovies.length }}/10)</span>
      <Progress :model-value="selectedMovies.length * 10" class="w-1/3" />
    </div>

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
  </div>
</template>
