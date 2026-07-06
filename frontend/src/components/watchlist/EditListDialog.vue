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

import { updateListSchema } from '@/lib/schemas';
import MovieBrowser from '@/components/MovieBrowser.vue';
import MovieFilterToggle from '@/components/MovieFilterToggle.vue';
import { useMoviesStore } from '@/stores/movies';
import { watchlistApi } from '@/api';
import { Pencil } from '@lucide/vue';
import type { TmdbMovie, WatchlistMovieResponse } from '@trailertinder/shared';

const props = defineProps<{
  name: string;
  watchlistId: number;
  movies: WatchlistMovieResponse[];
}>();

const { selectedMovies, addMovie, removeMovie, isSelected } = useMovieSelection();

const deletedMovies = ref<WatchlistMovieResponse[]>([]);

const isOpen = ref(false);
watch(isOpen, (open) => {
  if (open) {
    deletedMovies.value = [...props.movies];
  } else {
    resetDialog();
  }
});
const store = useMoviesStore();

const { handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(updateListSchema),
});

function removeFromList(movieId: number) {
  deletedMovies.value = deletedMovies.value.filter((m) => m.id !== movieId);
}

const onSubmit = handleSubmit(async (values) => {
  const moviesToDelete = props.movies.filter(
    (m) => !deletedMovies.value.some((d) => d.id === m.id),
  );

  for (const movie of moviesToDelete) {
    await watchlistApi.delete(props.watchlistId, movie.id);
  }

  for (const movie of selectedMovies.value) {
    await watchlistApi.addMovie(props.watchlistId, { tmdbId: movie.id });
  }

  if (values.name && values.name !== props.name) {
    await watchlistApi.update(props.watchlistId, { name: values.name });
  }
  toast.success('Edit Successfully');
  isOpen.value = false;
});

const resetDialog = () => {
  selectedMovies.value = [];
  store.resetSearch();
  resetForm();
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <Button variant="ghost" size="icon" class="shrink-0">
        <Pencil class="size-4" />
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-5/6">
      <DialogHeader>
        <DialogTitle>Edit: {{ name }}</DialogTitle>
        <DialogDescription>
          Rename your list, add new movies or remove existing ones.
        </DialogDescription>
      </DialogHeader>
      <form @submit.prevent="onSubmit" class="space-y-4">
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
          <Label for="delete-movies">Remove Movies</Label>
          <div class="max-h-40 md:max-h-80 overflow-y-auto scrollbar-thumb-primary">
            <TagsInput
              id="delete-movies"
              v-model="deletedMovies"
              class=""
              :display-value="(value) => (value as WatchlistMovieResponse).name"
            >
              <TagsInputItem
                v-for="item in deletedMovies"
                :key="item.id"
                :value="item"
                class="flex items-center gap-1 min-w-0"
              >
                <TagsInputItemText class="truncate" />
                <TagsInputItemDelete @click="removeFromList(item.id)" class="shrink-0" />
              </TagsInputItem>
              <TagsInputInput placeholder="" disabled />
            </TagsInput>
          </div>
          <Label for="movies">Add Movies</Label>
          <div
            class="max-h-40 md:max-h-80 overflow-y-auto scrollbar-thumb-primary"
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
