<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import Controls from "./Controls.vue";

interface PropsType {
  title: string;
  videoId?: string;
  controls?: boolean;
  active: boolean;
}

const props = defineProps<PropsType>();

const player = ref<YT.Player>();
const isPlaying = ref(false);
const volume = ref(false);

watch(
  () => props.active,
  (isActive) => {
    if (!player.value) return;
    if (isActive) {
      player.value.playVideo();
    } else {
      player.value.pauseVideo();
    }
  },
);

onMounted(() => {
  const init = () => {
    player.value = new window.YT.Player(`player-${props.videoId}`, {
      videoId: props.videoId,
      playerVars: {
        controls: 0,
        rel: 0,
        modestbranding: 0,
        autoplay: props.active ? 1 : 0,
        mute: 1,
      },
      events: {
        onStateChange: (e) => {
          isPlaying.value = e.data === window.YT.PlayerState.PLAYING;
        },
      },
    });
  };
  if (window.YT?.Player) {
    init();
  } else {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      init();
    };
  }
});

function toggleVolume() {
  if (!player.value) return;
  player.value.isMuted() ? player.value.unMute() : player.value.mute();
}

function togglePlay() {
  if (!player.value) return;
  isPlaying.value ? player.value.pauseVideo() : player.value.playVideo();
}
</script>

<template>
  <div class="h-full relative overflow-hidden">
    <div class="absolute inset-0 z-10" @click="togglePlay" />
    <Controls class="" @volume-event="toggleVolume" />
    <div :id="`player-${videoId}`" class="w-full h-full scale-y-125" />
  </div>
</template>
