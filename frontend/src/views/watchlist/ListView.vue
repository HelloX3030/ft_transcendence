<script setup lang="ts">
import MovieBrowser from '@/components/MovieBrowser.vue';
import MovieCard from '@/components/MovieCard.vue';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';



</script>

<template>
  <section class="flex-1 w-5/6 mx-auto p-8">
    <div>
      <h1 class="font-bold text-3xl">Best Movies</h1>
      <div class="flex items-center">
        <p class="text-md">List by</p>
        <Button variant="link">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <p class="text-md">Philipp</p>
        </Button>
      </div>
      <p class="text-muted-foreground">Updated/Published 22 days ago</p>
    </div>
    <p class="my-6">
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Error, laudantium similique nobis
      quia expedita aliquid. Perspiciatis quidem deleniti facilis saepe dicta repudiandae?
      Voluptatum, impedit ad quia minima id eum officia. Lorem ipsum dolor sit amet consectetur
      adipisicing elit. Rerum laboriosam, sapiente itaque sint, voluptatem accusantium quia sit
      iusto distinctio harum reiciendis modi enim, quisquam ducimus ea labore odio. Porro, pariatur?
    </p>
    <MovieBrowser :show-label="false">
      <template #movie="{ movie }">
        <MovieCard :title="movie.title" :img="movie.poster_path" :selected="false" />
      </template>
    </MovieBrowser>
  </section>
</template>
