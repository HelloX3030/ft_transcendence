import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { FeedMovie } from '@cinemates/shared';
import { moviesApi } from '@/api';
import { logger } from '@/lib/logger';

type FetchStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The personalised trailer feed.
 *
 * A store rather than a composable because resetPlugin clears every registered
 * store on logout: feed state held outside one would survive a sign-out and show
 * the first user's recommendations to the second on the same tab.
 *
 * The backend has no pagination — its /feed excludes only what the user has
 * *rated*, so calling again returns the same films minus any they reacted to.
 * "Load more" is therefore a refetch filtered through everything already shown.
 */
export const useFeedStore = defineStore('feed', () => {
  const cards = ref<FeedMovie[]>([]);
  const status = ref<FetchStatus>('idle');
  // True once a refetch came back with nothing new. Terminal until the user
  // reacts to something — which is why a *failed* refetch must not set it.
  const exhausted = ref(false);

  // Every tmdbId shown this session, so a film the recommender returns again is
  // never rendered twice. Mirrors the backend's own seen set.
  let shown = new Set<number>();

  // Bumped on every load and reset. A slower in-flight request that resolves
  // after the feed moved on (logout mid-request) sees a stale token and drops
  // its result instead of landing in a session it does not belong to.
  let generation = 0;

  async function load(): Promise<void> {
    const gen = ++generation;
    status.value = 'loading';
    cards.value = [];
    exhausted.value = false;
    shown = new Set();
    try {
      const data = await moviesApi.getFeed();
      if (gen !== generation) return;
      data.forEach((card) => shown.add(card.tmdbId));
      cards.value = data;
      status.value = 'ready';
    } catch (error) {
      if (gen !== generation) return;
      logger.debug(error);
      status.value = 'error';
    }
  }

  async function loadMore(): Promise<void> {
    if (status.value === 'loading' || exhausted.value) return;
    const gen = generation;
    status.value = 'loading';
    try {
      const data = await moviesApi.getFeed();
      if (gen !== generation) return;
      const fresh = data.filter((card) => !shown.has(card.tmdbId));
      fresh.forEach((card) => shown.add(card.tmdbId));
      cards.value = [...cards.value, ...fresh];
      // Judged on what is *new*, not on what came back: the backend almost
      // always answers with a full page.
      exhausted.value = fresh.length === 0;
      status.value = 'ready';
    } catch (error) {
      if (gen !== generation) return;
      logger.debug(error);
      // Not exhausted: a failure is retryable, and conflating the two would turn
      // a network blip into "you have seen everything".
      status.value = 'error';
    }
  }

  function $reset(): void {
    generation++;
    cards.value = [];
    status.value = 'idle';
    exhausted.value = false;
    shown = new Set();
  }

  return { cards, status, exhausted, load, loadMore, $reset };
});
