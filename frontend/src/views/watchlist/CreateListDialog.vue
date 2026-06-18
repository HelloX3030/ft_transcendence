<script setup lang="ts">
import { ref, watch } from 'vue';

import { toast } from 'vue-sonner';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';

import { useFetch } from '@/composables/useFetch';
import { useMovieSelection, type Movie } from '@/composables/useMovieSelection';

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
import { Textarea } from '@/components/ui/textarea';

const { searchedMovies } = useFetch();
const { selectedMovies, addMovie, removeMovie, isSelected } = useMovieSelection();
const isOpen = ref(false);

const { handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(createListSchema),
});

const onSubmit = handleSubmit((values) => {
  console.log(values);
  console.log(selectedMovies.value);
  toast.success('New List Created Successfully');
  isOpen.value = false;
});

const resetDialog = () => {
  selectedMovies.value = [];
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
              <Input v-bind="componentField" placeholder="My List..." autocomplete="off" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="description">
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea v-bind="componentField" placeholder="Description..." />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField name="image" v-slot="{ handleChange }">
          <FormItem>
            <FormLabel>Image</FormLabel>
            <FormControl>
              <Input
                type="file"
                accept="image/png"
                @change="(e: Event) => handleChange((e.target as HTMLInputElement).files?.[0])"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <div class="grid gap-3">
          <Label for="movies">Add Movies</Label>
          <TagsInput
            id="movies"
            v-model="selectedMovies"
            class=""
            :display-value="(value) => (value as Movie).title"
          >
            <TagsInputItem v-for="item in selectedMovies" :key="item.id" :value="item">
              <TagsInputItemText />
              <TagsInputItemDelete @click="removeMovie(item.id)" />
            </TagsInputItem>
            <TagsInputInput placeholder="" disabled />
          </TagsInput>
          <MovieSearch />
          <div class="grid grid-cols-4 gap-2 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            <MovieCard
              v-for="movie in searchedMovies"
              :key="movie.id"
              :title="movie.title"
              :img="movie.poster_path ?? null"
              :selected="isSelected(movie.id)"
              :loading="false"
              @select="addMovie({ title: movie.title, id: movie.id, img: movie.poster_path })"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose as-child>
            <Button variant="outline"> Cancel </Button>
          </DialogClose>
          <Button type="submit"> Create List </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
