<script setup lang="ts">
import { Pen } from '@lucide/vue';
import MovieCard from '@/components/MovieCard.vue';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel/index.ts';
import type { popular } from '@/lib/test.ts';
import { Button } from '../ui/button/index.ts';

interface Props {
  title: string;
  movies: typeof popular;
}

defineProps<Props>();
</script>

<template>
  <div class="group">
    <div class="space-y-2">
      <div class="flex justify-between">
        <h2 class="text-xl group-hover:text-primary duration-300 transition-colors ease-in-out">
          {{ title }}
        </h2>
        <div class="flex items-center gap-2">
          <p class="text-muted-foreground">{{ movies.length }} Films</p>
          <Button variant="ghost"><Pen /></Button>
        </div>
      </div>
    </div>

    <Carousel
      :opts="{
        align: 'start',
        slidesToScroll: 1,
        duration: 40,
      }"
    >
      <CarouselPrevious variant="default" class="absolute bg-black left-0 z-10 disabled:hidden" />
      <CarouselContent>
        <CarouselItem
          v-for="movie in movies"
          :key="movie.id"
          class="sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/6"
        >
          <MovieCard :title="movie.title" :img="movie.poster_path" />
        </CarouselItem>
      </CarouselContent>
      <CarouselNext variant="default" class="absolute right-0 bg-black z-10 disabled:hidden" />
    </Carousel>
  </div>
</template>
