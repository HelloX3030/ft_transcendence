import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Invalidation signal for watchlist data. Watchlist state is owned by per-view
 * composables rather than a store, so the event router has nothing global to
 * refetch. Bumping a counter those composables watch keeps invalidation
 * idempotent and order-independent.
 */
export const useWatchlistsStore = defineStore('watchlists', () => {
  const version = ref(0);

  function invalidate() {
    version.value++;
  }

  function $reset() {
    version.value = 0;
  }

  return { version, invalidate, $reset };
});
