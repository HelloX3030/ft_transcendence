<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import MovieSearch from '@/components/MovieSearch.vue';
import MovieBrowser from '@/components/MovieBrowser.vue';
import MovieFilterToggle from '@/components/MovieFilterToggle.vue';
import MovieCard from '@/components/MovieCard.vue';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import { useSelectionStore } from '@/stores/selection';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/user';

const selection = useSelectionStore();
const { selectedMovies } = storeToRefs(selection);
const userStore = useUserStore();
const router = useRouter();

const submitting = ref(false);
const error = ref('');

async function completeOnboarding() {
  submitting.value = true;
  error.value = '';
  try {
    await userStore.completeOnboarding(selectedMovies.value.map((movie) => movie.id));
    router.push('/');
  } catch (e) {
    error.value = (e as Error)?.message ?? 'Something went wrong. Please try again.';
  } finally {
    submitting.value = false;
  }
}

onUnmounted(selection.clearMovies);
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
    <Button :disabled="selectedMovies.length < 10 || submitting" @click="completeOnboarding">
      {{ submitting ? 'Saving…' : 'Next' }}
    </Button>
    <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
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
