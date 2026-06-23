<script setup lang="ts">
interface Props {
  posterUrl: string;
  title: string;
  tagline: string;
  releaseYear: string;
  runtime: string;
  rating: string;
  voteCount: number;
}

defineProps<Props>();
</script>

<template>
  <div class="flex gap-6 px-4 -mt-24 relative z-10">
    <img :src="posterUrl" :alt="title" class="w-36 rounded-xl shadow-2xl flex-shrink-0" />
    <div class="flex flex-col justify-end pb-2">
      <h1 class="text-2xl font-bold leading-tight">{{ title }}</h1>
      <p class="text-sm text-zinc-400 mt-1 italic">{{ tagline }}</p>
      <div class="flex items-center gap-2 text-sm text-zinc-400 mt-2 flex-wrap">
        <span>{{ releaseYear }}</span>
        <span>·</span>
        <span>{{ runtime }}</span>
        <span class="flex items-center gap-1">
          <span class="text-yellow-400 font-medium">⭐ {{ rating }}</span>
          <span class="text-zinc-600 text-xs">({{ voteCount }})</span>
        </span>
      </div>
    </div>
  </div>
</template>
