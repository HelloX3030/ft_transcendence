/**
 * The widget API, pinned to a player version and served from the cookie-free
 * host. The unversioned entry point is a bootstrap that answers with six
 * Set-Cookie headers, one of them SameSite=lax, which the browser rejects and
 * reports in the console. This URL is the same script with no cookies, and it
 * calls `onYouTubeIframeAPIReady` itself.
 */
const PINNED_API =
  'https://www.youtube-nocookie.com/s/player/b0d2d49a/www-widgetapi.vflset/www-widgetapi.js';

/** Reached only if the pinned version is ever withdrawn. See `loadYouTubeApi`. */
const FALLBACK_API = 'https://www.youtube.com/iframe_api';

/** Privacy-enhanced host: no identifying cookies until playback. */
const EMBED_HOST = 'https://www.youtube-nocookie.com';

let loading: Promise<typeof window.YT> | null = null;

export function loadYouTubeApi(): Promise<typeof window.YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;

  loading = new Promise((resolve) => {
    // The API calls this global when it is ready. Chained rather than
    // overwritten, so another caller's callback is not silently dropped.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };

    // Pinning a version trades a console warning for the risk that the version
    // is one day withdrawn, which is what the fallback covers.
    loadScript(PINNED_API, () => loadScript(FALLBACK_API));
  });

  return loading;
}

/**
 * No rejection path: if both scripts fail there is no player to build, and
 * rejecting would only turn a dead embed into an unhandled rejection.
 */
function loadScript(src: string, onError?: () => void): void {
  const tag = document.createElement('script');
  tag.src = src;
  if (onError) tag.addEventListener('error', onError, { once: true });
  document.head.appendChild(tag);
}

/**
 * The embed URL for a trailer, built here rather than by the API. We render the
 * iframe ourselves (see `VideoPlayer.vue`) because the one the API builds carries
 * an `allow` attribute that browsers warn about; on an element that is already an
 * iframe the API neither builds the URL nor reads `playerVars`, so the parameters
 * live here. `enablejsapi` makes the embed accept commands, and the host is what
 * the postMessage handshake targets.
 */
export function embedUrl(videoId: string): string {
  const params = new URLSearchParams({
    controls: '0',
    rel: '0',
    // Always 1, even for the cards either side of the active one: an embed built
    // with autoplay 0 loads its chrome but buffers no video, so a neighbour would
    // still start from cold on the swipe. onReady pauses it if it is not active.
    autoplay: '1',
    // Muted throughout: this is what makes the autoplay above permitted without
    // a user gesture. The real setting is applied once the embed is ready.
    mute: '1',
    // Without this, iOS Safari takes a trailer fullscreen on play and the swipe
    // feed stops being a feed.
    playsinline: '1',
    // The page's real origin, which is what the embed checks postMessage against.
    // Not an env var: only the runtime knows what the browser is showing.
    origin: window.location.origin,
    enablejsapi: '1',
  });

  return `${EMBED_HOST}/embed/${videoId}?${params}`;
}
