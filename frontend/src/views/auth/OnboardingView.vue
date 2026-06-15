<script setup lang="ts">
import MovieSearch from '@/components/MovieSearch.vue';
import MovieBrowser from '@/components/MovieBrowser.vue';
import MovieCard from '@/components/MovieCard.vue';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

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
    <Button :disabled="selectedMovies.length < 10" @click="completeOnboarding">Next</Button>
    <div class="flex items-center justify-between">
      <span>Selected({{ selectedMovies.length }}/10)</span>
      <Progress :model-value="selectedMovies.length * 10" class="w-1/3" />
    </div>

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
  </div>
</template>
