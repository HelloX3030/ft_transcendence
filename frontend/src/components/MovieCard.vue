<script setup lang="ts">
import { CircleCheck } from 'lucide-vue-next';

interface Props {
  title: string;
  img: string;
  selected?: boolean;
}

const props = defineProps<Props>();
</script>

<template>
  <div
    :class="[
      selected && 'outline-2',
      'hover:outline-2 hover:outline-primary  rounded-2xl relative hover:cursor-pointer transition-all duration-300 ease-in-out',
    ]"
  >
    <!-- <span class="absolute">{{ title }}</span> -->
    <CircleCheck class="absolute right-4 top-4 text-primary" v-if="selected" />
    <img :src="`https://image.tmdb.org/t/p/original/${img}`" :alt="title" class="rounded-2xl" />
  </div>
</template>
