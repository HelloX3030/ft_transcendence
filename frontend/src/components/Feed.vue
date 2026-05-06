<script setup lang="ts">
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const trailers = [
  { key: "BdJKm16Co6M", name: "#TBT Trailer" },
  { key: "JE9z-gy4De4", name: "Official New UK Trailer" },
  { key: "l0X5R1hRw8g", name: "Cybord" },
];
</script>

<template>
  <Carousel
    orientation="vertical"
    class="bg-amber-300 w-full mx-auto mt-4 h-full"
  >
    <CarouselContent class="bg-red-300 w-5/6 mx-auto my-0 h-full">
      <CarouselItem
        v-for="trailer in trailers"
        :key="trailer.key"
        class="h-full"
      >
        <iframe
          width="100%"
          height="100%"
          :src="`https://www.youtube-nocookie.com/embed/${trailer.key}?controls=1&rel=0`"
          :title="trailer.name"
          frameborder="0"
          allow="
            accelerometer;
            autoplay;
            clipboard-write;
            encrypted-media;
            gyroscope;
            picture-in-picture;
          "
          allowfullscreen
        />
      </CarouselItem>
    </CarouselContent>
    <CarouselPrevious class="left-1/2 -translate-x-1/2 top-4" />
    <CarouselNext class="left-1/2 -translate-x-1/2 bottom-4" />
  </Carousel>
</template>
