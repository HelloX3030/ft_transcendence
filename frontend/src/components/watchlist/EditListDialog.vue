<script setup lang="ts">
import { computed, watch } from 'vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from '@/components/ui/tags-input';
import MovieSearch from '@/components/MovieSearch.vue';
import MovieCard from '@/components/MovieCard.vue';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import MovieBrowser from '@/components/MovieBrowser.vue';
import MovieFilterToggle from '@/components/MovieFilterToggle.vue';
import type { TmdbMovie, WatchlistMovieResponse } from '@cinemates/shared';
import { useEditWatchlist } from '@/composables/watchlist/useEditWatchlist.ts';
import EditorListBox from './EditorListBox.vue';
import { toast } from 'vue-sonner';
import { logger } from '@/lib/logger';
import { ApiError } from '@/api/api-error';

const props = defineProps<{
  name: string;
  watchlistId: number;
  movies?: WatchlistMovieResponse[];
  editors?: number[];
}>();

const isOpen = defineModel<boolean>('open');

const {
  init: initEditWatchlist,
  reset: resetEditWatchlist,
  selectedMovies,
  addMovie,
  removeMovie,
  isSelected,
  selectedEditors,
  submit,
  isSubmitting,
} = useEditWatchlist({
  watchlistId: props.watchlistId,
  name: computed(() => props.name),
  movies: computed(() => props.movies),
  editors: computed(() => props.editors),
});

async function handleSubmit() {
  try {
    const result = await submit();

    // vee-validate resolves undefined without running the handler when the form
    // is invalid. Falling through to the success branch is what made an
    // over-long name report "Edit Successfully" while sending no request at all,
    // and closing the dialog destroyed the FormMessage that said otherwise.
    if (!result) return;

    if (result.failedCount > 0) {
      toast.error(`${result.failedCount} action(s) failed`);
    } else {
      toast.success('Edit Successfully');
    }
  } catch (error) {
    logger.error(error);
    toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
  }

  isOpen.value = false;
}

watch(isOpen, async (open) => {
  if (open) {
    await initEditWatchlist();
  } else {
    resetEditWatchlist();
  }
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <!-- A percentage is not a cap: at 3840px the dialog was 3200px wide and
         the picker's posters grew with it. The min() keeps the roomy feel on
         ordinary screens and stops it dead on an ultrawide. -->
    <DialogContent class="sm:max-w-[min(83.333%,1400px)]">
      <DialogHeader>
        <DialogTitle>Edit: {{ name }}</DialogTitle>
        <DialogDescription>
          Rename your list, add new movies or remove existing ones.
        </DialogDescription>
      </DialogHeader>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input
                :model-value="componentField.modelValue"
                @update:model-value="(value) => componentField['onUpdate:modelValue']?.(value)"
                :placeholder="name"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <div class="grid gap-3">
          <Label for="movies">Add Movies</Label>
          <!-- Capped well below the picker: at the old max-h-80 a long selection
               could claim as much height as the grid it was selected from. -->
          <div
            class="max-h-24 overflow-y-auto scrollbar-thumb-primary"
            v-show="selectedMovies.length > 0"
          >
            <TagsInput
              id="movies"
              v-model="selectedMovies"
              :display-value="(value) => (value as TmdbMovie).title"
            >
              <TagsInputItem
                v-for="item in selectedMovies"
                :key="item.id"
                :value="item"
                class="flex items-center gap-1 min-w-0"
              >
                <TagsInputItemText class="truncate" />
                <TagsInputItemDelete @click="removeMovie(item.id)" class="shrink-0" />
              </TagsInputItem>
              <TagsInputInput placeholder="" disabled />
            </TagsInput>
          </div>
          <MovieSearch />
          <MovieFilterToggle />
          <div class="max-h-64 md:max-h-96 overflow-y-auto scrollbar-thumb-primary">
            <MovieBrowser :show-label="false" density="compact">
              <template #movie="{ movie }">
                <MovieCard
                  :title="movie.title"
                  :img="movie.poster_path"
                  :selected="isSelected(movie.id)"
                  size="sm"
                  @select="addMovie(movie)"
                />
              </template>
            </MovieBrowser>
          </div>
        </div>
        <EditorListBox v-model="selectedEditors" />
        <DialogFooter>
          <!-- Cancel stays enabled: a stuck request must not trap the user. -->
          <DialogClose as-child>
            <Button variant="outline" type="button"> Cancel </Button>
          </DialogClose>
          <Button type="submit" :disabled="isSubmitting"> Edit </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
