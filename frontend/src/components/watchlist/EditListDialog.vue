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
import type { TmdbMovie, WatchlistMovieResponse } from '@trailertinder/shared';
import { useEditWatchlist } from '@/composables/watchlist/useEditWatchlist.ts';
import EditorListBox from './EditorListBox.vue';
import { toast } from 'vue-sonner';
import { logger } from '@/lib/logger';

const props = defineProps<{
  name: string;
  watchlistId: number;
  movies?: WatchlistMovieResponse[];
  editors?: number[];
}>();

const emit = defineEmits<{ success: [] }>();

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
} = useEditWatchlist({
  watchlistId: props.watchlistId,
  name: computed(() => props.name),
  movies: computed(() => props.movies),
  editors: computed(() => props.editors),
});

async function handleSubmit() {
  try {
    const result = await submit();
    const failedCount = result?.failedCount ?? 0;

    if (failedCount > 0) {
      toast.error(`${failedCount} action(s) failed`);
    } else {
      toast.success('Edit Successfully');
    }
    emit('success');
  } catch (error) {
    logger.error(error);
    toast.error('Something went wrong');
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
    <DialogContent class="sm:max-w-5/6">
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
          <div
            class="max-h-40 md:max-h-80 overflow-y-auto scrollbar-thumb-primary"
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
          <div class="max-h-40 md:max-h-80 overflow-y-auto scrollbar-thumb-primary">
            <MovieBrowser :show-label="false">
              <template #movie="{ movie }">
                <MovieCard
                  :title="movie.title"
                  :img="movie.poster_path"
                  :selected="isSelected(movie.id)"
                  @select="addMovie(movie)"
                />
              </template>
            </MovieBrowser>
          </div>
        </div>
        <EditorListBox v-model="selectedEditors" />
        <DialogFooter>
          <DialogClose as-child>
            <Button variant="outline" type="button"> Cancel </Button>
          </DialogClose>
          <Button type="submit"> Edit </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
