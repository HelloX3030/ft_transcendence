<!-- MovieCredits.vue -->
<script setup lang="ts">
interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string;
}

defineProps<{
  director: string;
  cast: CastMember[];
}>();
</script>

<template>
  <!-- Director -->
  <div class="px-6 mt-8">
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Director</p>
    <p class="text-sm text-zinc-200">{{ director }}</p>
  </div>

  <!-- Cast -->
  <div class="px-6 mt-8">
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Cast</p>
    <div class="flex gap-6">
      <div v-for="actor in cast" :key="actor.id" class="flex flex-col items-center gap-2 w-24">
        <img
          :src="`https://image.tmdb.org/t/p/w185${actor.profile_path}`"
          :alt="actor.name"
          class="w-16 h-16 rounded-full object-cover ring-2 ring-zinc-700"
        />
        <p class="text-xs text-center text-zinc-300 leading-tight font-medium w-full line-clamp-2">
          {{ actor.name }}
        </p>
        <p class="text-xs text-center text-zinc-500 leading-tight w-full line-clamp-2">
          {{ actor.character }}
        </p>
      </div>
    </div>
  </div>
</template>
