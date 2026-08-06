<script setup lang="ts">
import { ref } from 'vue';
import { ArrowLeft } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import VideoPlayer from '@/components/videoplayer/VideoPlayer.vue';
import type { TmdbMovieDetail } from '@cinemates/shared';
import type { Provider } from '@/lib/test';

defineProps<{
  movie: TmdbMovieDetail;
  providers: Provider[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const showControls = ref(true);
let hideTimer: ReturnType<typeof setTimeout>;

function handleMouseMove() {
  showControls.value = true;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    showControls.value = false;
  }, 5000);
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black" @mousemove="handleMouseMove">
    <div v-show="showControls" class="absolute bottom-6 md:bottom-10 left-6 z-50">
      <Button
        variant="outline"
        class="rounded-full size-11 flex items-center justify-center"
        @click="emit('close')"
      >
        <ArrowLeft class="size-5" />
      </Button>
    </div>

    <VideoPlayer
      :title="movie.title"
      :videoId="movie.trailerKey ?? ''"
      :active="true"
      :genreIds="movie.genres.map((g) => g.id)"
      :releaseDate="movie.release_date"
      :providers="providers"
      :showGenres="false"
      class="w-full h-full"
    />
  </div>
</template>
