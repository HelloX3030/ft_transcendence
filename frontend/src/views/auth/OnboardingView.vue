<script setup lang="ts">
import MovieSearch from '@/components/MovieSearch.vue';
import MovieSelect from '@/components/MovieSelect.vue';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import { useMovies } from '@/composables/useMovies';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';

const { selectedMovies } = useMovies();
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

    <MovieSelect />
  </div>
</template>
