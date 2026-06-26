<script setup lang="ts">
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import VideoPlayer from './videoplayer/VideoPlayer.vue';
import { ref, watch } from 'vue';
import { watchOnce } from '@vueuse/core';
import { useGlobalVideoPlayer } from '@/composables/useVideoPlayer';
import { popular } from '@/lib/test.ts';

const { isFullscreen } = useGlobalVideoPlayer();

const currentIndex = ref(0);
const api = ref<CarouselApi>();
const setApi = (val: CarouselApi) => {
  api.value = val;
};

watchOnce(api, (api) => {
  if (!api) return;

  currentIndex.value = api.selectedScrollSnap();
  api.on('select', () => {
    currentIndex.value = api.selectedScrollSnap();
  });
});

watch(isFullscreen, (fullscreen) => {
  if (fullscreen) {
    api.value?.reInit({ watchDrag: false });
  } else {
    api.value?.reInit({ watchDrag: true });
  }
});
</script>

<template>
  <Carousel
    orientation="vertical"
    class="w-full h-full border-0 outline-0 md:max-w-5/6 md:mx-auto"
    @init-api="setApi"
  >
    <CarouselContent class="h-full">
      <CarouselItem v-for="(trailer, index) in popular" :key="trailer.key" class="h-full">
        <VideoPlayer
          :title="trailer.title"
          :video-id="trailer.key"
          :active="currentIndex === index"
          :genre-ids="trailer.genre_ids"
          :release-date="trailer.release_date"
          :providers="trailer.providers"
          :show-genres="true"
        />
      </CarouselItem>
    </CarouselContent>
  </Carousel>
</template>
