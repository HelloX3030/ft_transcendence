import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Invalidation signal for watchlist data.
 *
 * Watchlist state is owned by per-view composables rather than a store, so the
 * event router has nothing global to refetch. Bumping a counter that those
 * composables watch keeps invalidation idempotent and order-independent — two
 * events in a row simply refetch once more, and a view that is not mounted
 * refetches when it next is.
 */
export const useWatchlistsStore = defineStore('watchlists', () => {
  const version = ref(0);

  function invalidate() {
    version.value++;
  }

  return { version, invalidate };
});
