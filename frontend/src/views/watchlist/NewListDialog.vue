<script setup lang="ts">
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

import { ref } from 'vue';
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from '@/components/ui/tags-input';
import MovieSearch from '@/components/MovieSearch.vue';
import MovieGrid from '@/components/MovieGrid.vue';
import { useFetch } from '@/composables/useFetch';
import MovieCard from '@/components/MovieCard.vue';
import { useMovies } from '@/composables/useMovies';

const { searchedMovies } = useFetch();

const { selectedMovies, addMovie } = useMovies();
</script>

<template>
  <Dialog>
    <form>
      <DialogTrigger as-child>
        <Button variant="outline">+ New</Button>
      </DialogTrigger>
      <DialogContent class="sm:max-w-5/6">
        <DialogHeader>
          <DialogTitle>New List</DialogTitle>
          <DialogDescription> Create a new movie list. </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4">
          <div class="grid gap-3">
            <Label for="name-1">Name</Label>
            <Input id="name-1" name="name" default-value="My List..." />
          </div>
          <div class="grid gap-3">
            <Label for="image-1">Image</Label>
            <Input id="image-1" name="image" default-value="" type="file" />
          </div>
        </div>
        <div class="grid gap-3">
          <Label for="movies">Movies</Label>
          <TagsInput id="movies" v-model="selectedMovies" class="">
            <TagsInputItem v-for="item in selectedMovies" :key="item.id" :value="item.title">
              <TagsInputItemText />
              <TagsInputItemDelete />
            </TagsInputItem>
            <TagsInputInput placeholder="Movies..." disabled />
          </TagsInput>
          <MovieSearch />
          <div class="grid grid-cols-4 gap-2 md:grid-cols-8 xl:grid-cols-16">
            <MovieCard
              v-for="movie in searchedMovies"
              :key="movie.id"
              :title="movie.title"
              :img="movie.poster_path"
              :selected="false"
              :loading="false"
              @select="addMovie(movie)"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose as-child>
            <Button variant="outline"> Cancel </Button>
          </DialogClose>
          <Button type="submit"> Create List </Button>
        </DialogFooter>
      </DialogContent>
    </form>
  </Dialog>
</template>
