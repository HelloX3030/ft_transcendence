<script setup lang="ts">
import { Heart, X, Bookmark } from 'lucide-vue-next';
import { ref } from 'vue';

// Whether the movie has a playable trailer — drives the trailer button's state.
defineProps<{ hasTrailer: boolean }>();

//TODO: liked, disliked, saved in DB speichern und beim Laden der Seite abrufen
const isLiked = ref(false);
const isDisliked = ref(false);
const isSaved = ref(false);

function toggleLike() {
  isLiked.value = !isLiked.value;
  if (isLiked.value) isDisliked.value = false;
}

function toggleDislike() {
  isDisliked.value = !isDisliked.value;
  if (isDisliked.value) isLiked.value = false;
}
</script>

<template>
  <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
    <div
      class="flex items-center gap-4 bg-zinc-800 text-zinc-300 font-semibold px-5 py-3 rounded-full shadow-xl"
    >
      <button @click="toggleLike">
        <Heart :class="isLiked ? 'text-red-500 fill-red-500' : 'text-zinc-300'" class="size-5" />
      </button>
      <button @click="toggleDislike">
        <X :class="isDisliked ? 'text-blue-400 fill-blue-400' : 'text-zinc-300'" class="size-5" />
      </button>
      <button @click="isSaved = !isSaved">
        <Bookmark
          :class="isSaved ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-300'"
          class="size-5"
        />
      </button>
    </div>

    <button
      :disabled="!hasTrailer"
      class="w-full flex items-center justify-center gap-2 font-semibold px-5 py-3 rounded-full shadow-xl transition-all duration-200"
      :class="
        hasTrailer
          ? 'bg-orange-600 hover:bg-orange-500 text-white'
          : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
      "
      @click="$emit('trailer')"
    >
      {{ hasTrailer ? '▶ Trailer' : 'No trailer' }}
    </button>
  </div>
</template>
