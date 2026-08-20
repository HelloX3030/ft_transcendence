<script setup lang="ts">
import { computed, useTemplateRef, toRef } from 'vue';
import { useVideoPlayer } from '@/composables/useVideoPlayer';
import { embedUrl } from '@/lib/youtube';
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
// The iframe is ours, not one YouTube builds for us: handed an ordinary
// element, the API replaces it with an iframe carrying an `allow` attribute
// that names features browsers do not recognise, and warns once per name per
// player. Handed an iframe, it attaches to it and writes no attributes.
const playerHost = useTemplateRef<HTMLIFrameElement>('player-host');

const src = computed(() => embedUrl(props.videoId));

// Playback follows `active` and the global mute setting from inside the
// composable: both have to wait for the YouTube embed to report itself ready,
// and only the composable knows when that happens.
const { showInfo, togglePlay, toggleFullscreen, handleMouseMove } = useVideoPlayer(
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
    <!--
      Two delegations, not the seven YouTube writes for itself. The five that
      are gone are for 360° video, DRM and the player's own copy-link button,
      none of which a muted trailer with `controls: 0` uses.

      `compute-pressure` is here because the player probes it and Chrome logs a
      permissions-policy violation per probe when it is not granted; `autoplay`
      because Chrome delegates unmuted playback in a cross-origin frame through
      it, and the sound toggle unmutes one. Both are names Firefox does not
      know, so it warns about them instead, an accepted trade: a clean Chrome
      console is the target, and Firefox's remaining noise is YouTube's own
      document either way.
    -->
    <iframe
      ref="player-host"
      :src="src"
      :title="`${title}, trailer`"
      allow="autoplay; compute-pressure"
      class="w-full h-full lg:scale-y-125 scale-y-150"
      frameborder="0"
    />
  </div>
</template>
