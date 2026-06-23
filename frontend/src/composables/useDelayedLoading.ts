import { onScopeDispose, ref, watch, type Ref } from 'vue';

interface Options {
  /** Don't show the loader unless loading is still active after this many ms. */
  delay?: number;
  /** Once shown, keep the loader up for at least this many ms. */
  minDuration?: number;
}

/**
 * Smooths a loading flag for display: it stays false for fast operations (no
 * flash on cache hits) and, once shown, stays visible long enough to avoid a
 * flicker. The source ref should reflect the true loading state; the returned
 * ref is the one to render.
 */
export function useDelayedLoading(source: Ref<boolean>, options: Options = {}): Ref<boolean> {
  const { delay = 200, minDuration = 400 } = options;
  const visible = ref(false);

  let delayTimer: ReturnType<typeof setTimeout> | null = null;
  let minTimer: ReturnType<typeof setTimeout> | null = null;
  let shownAt = 0;

  function clearDelay() {
    if (delayTimer !== null) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
  }

  function clearMin() {
    if (minTimer !== null) {
      clearTimeout(minTimer);
      minTimer = null;
    }
  }

  watch(source, (loading) => {
    if (loading) {
      // A new load cancels any pending hide and keeps the loader up.
      clearMin();
      if (visible.value || delayTimer !== null) return;
      delayTimer = setTimeout(() => {
        visible.value = true;
        shownAt = Date.now();
        delayTimer = null;
      }, delay);
      return;
    }

    // Finished before the delay elapsed → never show anything.
    if (delayTimer !== null) {
      clearDelay();
      return;
    }

    // Already showing → hold for the remainder of the minimum duration.
    if (visible.value) {
      const remaining = minDuration - (Date.now() - shownAt);
      if (remaining <= 0) {
        visible.value = false;
      } else {
        minTimer = setTimeout(() => {
          visible.value = false;
          minTimer = null;
        }, remaining);
      }
    }
  });

  onScopeDispose(() => {
    clearDelay();
    clearMin();
  });

  return visible;
}
