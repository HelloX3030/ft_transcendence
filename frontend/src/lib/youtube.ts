/**
 * Loads the YouTube IFrame API once, on first use.
 *
 * Used to be an app plugin that ran at boot, which meant every user contacted
 * YouTube — and ran its script, and got whatever it logs — on the login screen,
 * on their watchlist, everywhere. The feed is the only thing that needs it.
 */
let loading: Promise<typeof window.YT> | null = null;

export function loadYouTubeApi(): Promise<typeof window.YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;

  loading = new Promise((resolve) => {
    // The API calls this global when it is ready. Chained rather than
    // overwritten: nothing else sets it today, and silently dropping someone
    // else's callback is the kind of bug that surfaces months later.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });

  return loading;
}
