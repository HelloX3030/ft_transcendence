<script setup lang="ts">
import { ref, watch } from 'vue';

import { toast } from 'vue-sonner';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';

import { useMovieSelection } from '@/composables/useMovieSelection';

import { Button } from '@/components/ui/button';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

import { createListSchema } from '@/lib/schemas';
import MovieBrowser from '@/components/MovieBrowser.vue';
import MovieFilterToggle from '@/components/MovieFilterToggle.vue';
import { useMoviesStore } from '@/stores/movies';
import { useWatchlistsStore } from '@/stores/watchlists';
import { watchlistApi } from '@/api';
import type { TmdbMovie } from '@trailertinder/shared';
import { useEditorSelection } from '@/composables/watchlist/useEditorSelection';
import EditorListBox from './EditorListBox.vue';
import { logger } from '@/lib/logger';

const store = useMoviesStore();
const watchlists = useWatchlistsStore();
const { selectedMovies, addMovie, removeMovie, isSelected } = useMovieSelection();
const { selectedEditors } = useEditorSelection();
const isOpen = ref(false);

const { handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(createListSchema),
});

const onSubmit = handleSubmit(async (values) => {
  try {
    const watchlistData = await watchlistApi.create({ name: values.name });
    if (!watchlistData) return;

    const results = await Promise.allSettled(
      selectedMovies.value.map((m) => watchlistApi.addMovie(watchlistData.id, { tmdbId: m.id })),
    );
    await Promise.allSettled(
      selectedEditors.value.map((id) =>
        watchlistApi.addUser(watchlistData.id, { userId: id, role: 'editor' }),
      ),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      toast.warning(`List created but ${failed.length} movie(s) couldn't be added`);
    } else {
      toast.success('New List Created Successfully');
    }
    // The overview will not hear about this from the socket — the backend
    // excludes the actor from their own events.
    watchlists.invalidate();
  } catch (error) {
    logger.error(error);
    toast.error('Something went wrong');
  }
  isOpen.value = false;
});

const resetDialog = () => {
  selectedMovies.value = [];
  store.resetSearch();
  resetForm();
};

watch(isOpen, (open) => {
  if (!open) resetDialog();
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <Button variant="outline" class="md:text-xl">+ New</Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-5/6">
      <DialogHeader>
        <DialogTitle>Create New List</DialogTitle>
        <DialogDescription> Create a new movie list. To share with your friends.</DialogDescription>
      </DialogHeader>
      <form @submit.prevent="onSubmit" class="space-y-4">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input
                :model-value="componentField.modelValue"
                @update:model-value="(value) => componentField['onUpdate:modelValue']?.(value)"
                placeholder="My List..."
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
              class=""
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
          <EditorListBox v-model="selectedEditors" />
        </div>
        <DialogFooter>
          <DialogClose as-child>
            <Button variant="outline" type="button"> Cancel </Button>
          </DialogClose>
          <Button type="submit"> Create List </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
