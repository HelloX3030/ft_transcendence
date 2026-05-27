import { ref } from 'vue';

const isMuted = ref(true);
const isFullscreen = ref(false);

export function useVideoPlayer() {
  function toggleVolume() {
    isMuted.value = !isMuted.value;
  }

  function toggleFullscreen(container: HTMLDivElement) {
    if (document.fullscreenElement) {
      //wenn document.fullscreen gesetzt
      document.exitFullscreen();
    } else {
      container.requestFullscreen(); //if document.fullscreen == NULL
    }
    isFullscreen.value = !isFullscreen.value;
  }
  // Orientation: Landscape → Fullscreen, Portrait → Fullscreen beenden
  function handleOrientationChange(container: HTMLDivElement | null, active: boolean) {
    if (!active || !container) return;

    const isLandscape = screen.orientation
      ? screen.orientation.type.includes('landscape')
      : window.matchMedia('(orientation: landscape)').matches;

    if (isLandscape && !isFullscreen.value) {
      container.requestFullscreen();
      isFullscreen.value = true;
    } else if (!isLandscape && isFullscreen.value) {
      document.exitFullscreen();
      isFullscreen.value = false;
    }
  }
  return { isMuted, toggleVolume, isFullscreen, toggleFullscreen, handleOrientationChange };
}
