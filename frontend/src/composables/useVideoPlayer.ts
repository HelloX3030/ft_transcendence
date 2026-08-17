import { ref, onMounted, onBeforeUnmount, watch, type Ref } from 'vue';
import { loadYouTubeApi } from '@/lib/youtube';

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
  activeRef: Ref<boolean>,
  containerRef: Ref<HTMLElement | null>,
  // An iframe, not any element: handed anything else, the API builds its own
  // and writes an `allow` attribute onto it that every browser warns about.
  // The type is what stops that being reintroduced by accident.
  hostRef: Ref<HTMLIFrameElement | null>,
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

  /**
   * Resolves once the iframe holds its YouTube document.
   *
   * A freshly inserted iframe still has `about:blank` in it, which inherits
   * this page's origin. The API starts a 250ms handshake poll the moment it is
   * constructed and aims each `postMessage` at the embed's host, so every tick
   * before the real document commits is refused by the browser and logged.
   *
   * Waiting costs nothing: the handshake could not have succeeded before the
   * document existed either way — it only stops the failed attempts being made.
   */
  function iframeLoaded(frame: HTMLIFrameElement): Promise<void> {
    // A committed cross-origin document makes contentDocument null; while the
    // iframe still holds about:blank it is same-origin and readable. That is
    // the difference between "already loaded" and "load is still coming", and
    // without it a load that beat us here would leave this waiting forever.
    if (frame.contentDocument === null) return Promise.resolve();
    return new Promise((resolve) => {
      frame.addEventListener('load', () => resolve(), { once: true });
    });
  }

  // YouTube Init
  async function initPlayer() {
    await loadYouTubeApi();
    // Awaiting yields to the microtask queue, so a card unmounted while the API
    // was still loading arrives here with `disposed` already set.
    //
    // The element itself, not an id. The id used to be built from the trailer
    // key, which is not unique across the feed — two cards sharing a trailer
    // put two nodes under one id and YouTube took over whichever came first.
    if (disposed || !hostRef.value) return;

    await iframeLoaded(hostRef.value);
    // Swiped past while the embed was loading: there is nothing left to drive,
    // and constructing a player here would only build one to destroy.
    if (disposed || !hostRef.value) return;

    // The iframe already carries the video, the parameters and the host (see
    // `embedUrl`), because on the existing-iframe path the API reads none of
    // them: it derives the host from our src and never builds a URL. Only the
    // events are its business.
    //
    // What remains in the console after this is YouTube's own document —
    // Firefox parsing their minified bundle, their frame's CSP and cookies,
    // and Firefox announcing that its storage partitioning engaged. None of it
    // is suppressible from the embedding side.
    player.value = new window.YT.Player(hostRef.value, {
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
    void initPlayer();
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
