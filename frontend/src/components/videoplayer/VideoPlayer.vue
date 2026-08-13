<script setup lang="ts">
import { useTemplateRef, toRef } from 'vue';
import { useVideoPlayer } from '@/composables/useVideoPlayer';
import VideoInfo from './VideoInfo.vue';
import Controls from './Controls.vue';
import type { WatchProvider } from '@cinemates/shared';

const props = defineProps<{
  title: string;
  tmdbId: number;
  videoId: string;
  active: boolean;
  genreIds: number[];
  providers: WatchProvider[];
  releaseDate: string;
  showGenres?: boolean;
}>();

const container = useTemplateRef<HTMLElement>('video-container');
// YouTube replaces this node with its iframe, so it is handed over directly
// rather than looked up by id.
const playerHost = useTemplateRef<HTMLElement>('player-host');

// Playback follows `active` and the global mute setting from inside the
// composable: both have to wait for the YouTube embed to report itself ready,
// and only the composable knows when that happens.
const { showInfo, togglePlay, toggleFullscreen, handleMouseMove } = useVideoPlayer(
  props.videoId,
  toRef(props, 'active'),
  container,
  playerHost,
);
</script>

<template>
  <div ref="video-container" class="h-full relative overflow-hidden" @mousemove="handleMouseMove">
    <div class="absolute inset-0 z-10" @click="togglePlay" />
    <Controls v-show="showInfo" :tmdb-id="tmdbId" @fullscreen-event="toggleFullscreen" />
    <VideoInfo
      v-show="showInfo"
      :title="title"
      :genre-ids="genreIds"
      :providers="providers"
      :release-date="releaseDate"
      :show-genres="showGenres"
    />
    <div ref="player-host" class="w-full h-full lg:scale-y-125 scale-y-150" />
  </div>
</template>
