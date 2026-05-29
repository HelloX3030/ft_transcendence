<script setup lang="ts">
import MovieGrid from '@/components/MovieGrid.vue';
import { popular } from '@/lib/test';
</script>

<template>
  <section class="flex-1 w-5/6 mx-auto p-8">
    <h1 class="font-bold text-3xl">Best Movies</h1>
    <p class="text-muted-foreground my-6">
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Error, laudantium similique nobis
      quia expedita aliquid. Perspiciatis quidem deleniti facilis saepe dicta repudiandae?
      Voluptatum, impedit ad quia minima id eum officia. Lorem ipsum dolor sit amet consectetur
      adipisicing elit. Rerum laboriosam, sapiente itaque sint, voluptatem accusantium quia sit
      iusto distinctio harum reiciendis modi enim, quisquam ducimus ea labore odio. Porro, pariatur?
    </p>
    <MovieGrid :movies="popular" />
  </section>
</template>
