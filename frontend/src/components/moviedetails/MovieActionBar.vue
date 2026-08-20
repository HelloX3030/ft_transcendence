<script setup lang="ts">
// Whether the movie has a playable trailer, drives the trailer button's state.
defineProps<{ hasTrailer: boolean }>();
</script>

<template>
  <button
    :disabled="!hasTrailer"
    class="fixed bottom-6 right-6 z-50 flex items-center justify-center gap-2 font-semibold px-5 py-3 rounded-full shadow-xl transition-all duration-200"
    :class="
      hasTrailer
        ? 'bg-orange-600 hover:bg-orange-500 text-white'
        : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
    "
    @click="$emit('trailer')"
  >
    {{ hasTrailer ? '▶ Trailer' : 'No trailer' }}
  </button>
</template>
