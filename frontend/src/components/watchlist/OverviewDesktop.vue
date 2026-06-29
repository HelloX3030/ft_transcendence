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
import { Button } from '../ui/button/index.ts';
import { onMounted, ref } from 'vue';
import type { WatchlistMovieResponse, WatchlistResponse } from '@trailertinder/shared/index.ts';
import { useWatchlist } from '@/composables/useWatchlist.ts';

const { getMovieIdsFromWatchlist } = useWatchlist();

const props = defineProps<WatchlistResponse>();

const movieIds = ref<WatchlistMovieResponse[] | null | undefined>([]);

onMounted(async () => {
  movieIds.value = await getMovieIdsFromWatchlist(props.id);
});
</script>

<template>
  <div class="group">
    <div class="space-y-2">
      <div class="flex justify-between items-baseline">
        <div class="flex justify-between items-baseline space-x-4">
          <h2 class="text-xl group-hover:text-primary duration-300 transition-colors ease-in-out">
            {{ name }}
          </h2>
          <span class="text-muted-foreground text-xs">{{
            new Date(createdAt).toLocaleDateString()
          }}</span>
        </div>

        <div class="flex items-center gap-2">
          <p class="text-muted-foreground">{{ movieIds?.length }} Films</p>
          <Button v-if="role === 'editor'" variant="ghost"><Pen /></Button>
        </div>
      </div>
    </div>

    <!-- <Carousel
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
    </Carousel> -->
  </div>
</template>
