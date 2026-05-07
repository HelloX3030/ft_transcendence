<script setup lang="ts">
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import VideoPlayer from "./VideoPlayer.vue";
import { ref } from "vue";
import { watchOnce } from "@vueuse/core";

const trailers = [
  { key: "BdJKm16Co6M", name: "#TBT Trailer" },
  { key: "JE9z-gy4De4", name: "Official New UK Trailer" },
  { key: "l0X5R1hRw8g", name: "Cybord" },
];

const currentIndex = ref(0);
const api = ref<CarouselApi>();
const setApi = (val: CarouselApi) => {
  api.value = val;
};

watchOnce(api, (api) => {
  if (!api) return;

  currentIndex.value = api.selectedScrollSnap();
  api.on("select", () => {
    currentIndex.value = api.selectedScrollSnap();
  });
});
</script>

<template>
  <Carousel
    orientation="vertical"
    class="w-full mx-auto h-full border-0 outline-0"
    @init-api="setApi"
  >
    <CarouselContent class="w-5/6 mx-auto h-full">
      <CarouselItem
        v-for="(trailer, index) in trailers"
        :key="trailer.key"
        class="h-full"
      >
        <VideoPlayer
          :title="trailer.name"
          :video-id="trailer.key"
          :active="currentIndex === index"
        />
      </CarouselItem>
    </CarouselContent>
  </Carousel>
</template>
