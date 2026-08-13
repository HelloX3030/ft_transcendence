import { ref, onMounted, onBeforeUnmount, watch, type Ref } from 'vue';

const isMuted = ref(true);
const isFullscreen = ref(false);

// Global State
export function useGlobalVideoPlayer() {
  function toggleVolume() {
    isMuted.value = !isMuted.value;
  }

  return { isMuted, isFullscreen, toggleVolume };
}

// Instance State
export function useVideoPlayer(
  videoId: string,
  activeRef: Ref<boolean>,
  containerRef: Ref<HTMLElement | null>,
  hostRef: Ref<HTMLElement | null>,
) {
  const player = ref<YT.Player>();
  const isPlaying = ref(false);
  const showInfo = ref(true);
  // new YT.Player() returns an object whose API methods (playVideo, mute,
  // destroy…) only exist once the embed has loaded and onReady has fired.
  // Calling one before that throws, so every caller waits on this.
  const isReady = ref(false);
  // Set once the component is gone. An embed that finishes loading after that
  // has no card left to play on, and destroy() was unavailable while it was
  // still loading — so the teardown is deferred to onReady instead.
  let disposed = false;
  let hideTimer: ReturnType<typeof setTimeout>;

  /** Play or pause to match `activeRef`. No-op until the embed is ready. */
  function syncActive() {
    if (!isReady.value || !player.value) return;
    if (activeRef.value) {
      player.value.playVideo();
      showInfo.value = true;
    } else {
      player.value.pauseVideo();
    }
  }

  /** Apply the global mute setting. No-op until the embed is ready. */
  function syncMuted() {
    if (!isReady.value || !player.value) return;
    if (isMuted.value) player.value.mute();
    else player.value.unMute();
  }

  // YouTube Init
  function initPlayer() {
    const init = () => {
      // The element itself, not an id. The id used to be built from the trailer
      // key, which is not unique across the feed — two cards sharing a trailer
      // put two nodes under one id and YouTube took over whichever came first.
      if (!hostRef.value) return;
      player.value = new window.YT.Player(hostRef.value, {
        videoId,
        playerVars: {
          controls: 0,
          rel: 0,
          // Always 1, even for the cards either side of the active one. An
          // embed built with autoplay 0 loads its chrome and poster but buffers
          // no video, so a windowed neighbour that had finished loading still
          // started from cold on the swipe onto it and showed a poster until
          // enough arrived to play. Autoplaying it buffers and paints a real
          // first frame; onReady below pauses it again if it is not the active
          // card, leaving the swipe a resume rather than a cold start.
          autoplay: 1,
          // Muted throughout: this is what makes the autoplay above permitted
          // without a user gesture, and syncMuted applies the real setting once
          // the embed is ready.
          mute: 1,
          origin: window.location.origin, //TODO: use env for url
        },
        events: {
          onReady: (event) => {
            // Swiped past while it was still loading. event.target rather than
            // player.value, which the unmount already cleared.
            if (disposed) {
              event.target.destroy();
              return;
            }
            isReady.value = true;
            // The card may have been swiped onto, or the sound toggled, during
            // the seconds the embed took to load. Apply the state as it is now
            // rather than as it was when the player was created.
            syncMuted();
            syncActive();
          },
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
  }

  // Play/Pause
  function togglePlay() {
    if (!isReady.value || !player.value) return;
    if (isPlaying.value) player.value.pauseVideo();
    else player.value.playVideo();
  }

  // Fullscreen
  function toggleFullscreen() {
    if (!containerRef.value) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      isFullscreen.value = false;
    } else {
      containerRef.value.requestFullscreen();
      isFullscreen.value = true;
    }
  }

  // Info Timer
  function startHideTimer() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      showInfo.value = false;
    }, 5000);
  }

  function handleMouseMove() {
    showInfo.value = true;
    startHideTimer();
  }

  // Orientation
  function handleOrientationChange() {
    if (!activeRef.value || !containerRef?.value) return;
    const isLandscape = screen.orientation
      ? screen.orientation.type.includes('landscape')
      : window.matchMedia('(orientation: landscape)').matches;

    if (isLandscape && !isFullscreen.value) {
      containerRef.value.requestFullscreen();
      isFullscreen.value = true;
    } else if (!isLandscape && isFullscreen.value) {
      document.exitFullscreen();
      isFullscreen.value = false;
    }
  }

  // Lifecycle

  // Owned here rather than in the component: both need the readiness gate, and
  // the component had no way to know about it.
  watch(activeRef, syncActive);
  watch(isMuted, syncMuted);

  onMounted(() => {
    initPlayer();
    startHideTimer();

    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    } else {
      window.addEventListener('orientationchange', handleOrientationChange);
    }
  });
  // onBeforeUnmount, not onUnmounted: destroy() has to run while the iframe is
  // still in the document. Vue has already detached it by the time onUnmounted
  // fires, and YouTube then refuses the call and warns on every swipe.
  onBeforeUnmount(() => {
    disposed = true;
    clearTimeout(hideTimer);
    // destroy() is one of the methods that only exists once onReady has fired.
    // Unmounting a card that is still loading is routine now that players are
    // windowed, so this is a normal path, not an edge case — onReady above
    // finishes the teardown for those.
    if (isReady.value) player.value?.destroy();
    player.value = undefined;
    isReady.value = false;
    if (screen.orientation) {
      screen.orientation.removeEventListener('change', handleOrientationChange);
    } else {
      window.removeEventListener('orientationchange', handleOrientationChange);
    }
  });

  return {
    player,
    isPlaying,
    showInfo,
    togglePlay,
    toggleFullscreen,
    handleMouseMove,
  };
}
