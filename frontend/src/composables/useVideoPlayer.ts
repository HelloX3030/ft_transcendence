import { ref } from 'vue';

const isMuted = ref(true);
const isFullscreen = ref(false);

function syncFullscreenState() {
  isFullscreen.value = !!document.fullscreenElement; //wenn FullScreen (toggleFullscreen) dann isFullScreen.value == true
}

document.addEventListener('fullscreenchange', syncFullscreenState);

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
  }

  function setFullScreen(state: boolean, container: HTMLDivElement) {
    if (state) {
      isFullscreen.value = true;
      container.requestFullscreen();
    } else {
      isFullscreen.value = false;
      document.exitFullscreen();
    }
  }

  return { isMuted, toggleVolume, isFullscreen, toggleFullscreen, setFullScreen };
}

// ÄNDERUNG: fullscreenchange Listener von onMounted/onUnmounted auf Modul-Ebene verschoben.
// Grund: Listener war an Component-Lifecycle gebunden und wurde beim reInit des Carousels
// kurz entfernt, wodurch isFullscreen nicht mehr korrekt aktualisiert wurde.
