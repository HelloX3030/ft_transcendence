<script setup lang="ts">
import { CircleCheck } from 'lucide-vue-next';
import { AspectRatio } from './ui/aspect-ratio';
import { Skeleton } from './ui/skeleton';

interface Props {
  title: string;
  img: string | null;
  selected?: boolean;
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <AspectRatio :ratio="2 / 3" class="rounded-2xl">
    <!-- Skeleton -->
    <template v-if="loading">
      <Skeleton class="absolute inset-0" />
    </template>

    <!-- Movie -->
    <template v-else>
      <div
        :class="[
          selected ? 'outline-2 outline-primary' : '',
          'hover:outline-2 hover:outline-primary absolute inset-0 rounded-2xl hover:cursor-pointer transition-all duration-300 ease-in-out ',
        ]"
        @click="$emit('select')"
      >
        <CircleCheck class="absolute right-4 top-4 text-primary z-10" v-if="selected" />
        <img
          v-if="img"
          :src="`https://image.tmdb.org/t/p/w500/${img}`"
          :alt="title"
          class="rounded-2xl w-full h-full object-cover"
          loading="lazy"
        />
        <div v-else class="rounded-2xl w-full h-full bg-muted"></div>
        <div class="bg-black/50 absolute bottom-0 w-full p-4 rounded-b-2xl">
          <span class="text-sm line-clamp-2">{{ title }}</span>
        </div>
      </div>
    </template>
  </AspectRatio>
</template>
