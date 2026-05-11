import { ref } from "vue";

const isMuted = ref(true);
const isFullscreen = ref(false);

export function useVideoPlayer() {
  function toggleVolume() {
    isMuted.value = !isMuted.value;
  }

  function toggleFullscreen(container: HTMLDivElement) {
    if (document.fullscreenElement) document.exitFullscreen();
    else container.requestFullscreen();
    isFullscreen.value = !isFullscreen.value;
  }

  return { isMuted, toggleVolume, isFullscreen, toggleFullscreen };
}
