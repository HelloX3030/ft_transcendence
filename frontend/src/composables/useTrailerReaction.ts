import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { toast } from 'vue-sonner';
import { moviesApi } from '@/api';
import { ApiError } from '@/api/api-error';
import { useReactionsStore } from '@/stores/reactions';
import type { ReactionType } from '@cinemates/shared';

/**
 * Like / dislike for one trailer. A reaction is permanent: the recommendation
 * service accumulates it into the taste profile and has no message that takes one
 * back, so both buttons lock on the first click. Lives here rather than in
 * `Controls.vue` so the node test suite can cover it without `@vue/test-utils`.
 */
export function useTrailerReaction(tmdbId: MaybeRefOrGetter<number>) {
  // Held in the store so it survives the player being unmounted. null = no
  // reaction yet; once set, it returns to null only on failure.
  const store = useReactionsStore();
  const reaction = computed(() => store.reactions[toValue(tmdbId)] ?? null);
  const pending = ref(false);

  watch(
    () => toValue(tmdbId),
    (id) => void store.ensureLoaded(id),
    { immediate: true },
  );

  const isLiked = computed(() => reaction.value === 'like');
  const isDisliked = computed(() => reaction.value === 'dislike');
  const isLocked = computed(() => reaction.value !== null || pending.value);

  async function react(next: ReactionType) {
    // One reaction per movie, ever, and this is also what makes a double-click
    // safe, since the second click is dropped here rather than reaching the
    // server.
    if (isLocked.value) return;

    // Read once: a getter id may change while the request is in flight.
    const id = toValue(tmdbId);
    const previous = store.reactions[id];
    store.reactions[id] = next; // optimistic: fills and locks both buttons
    pending.value = true;
    try {
      await moviesApi.setReaction(id, next);
    } catch (error) {
      // 409 means a row already exists, the state we were asking for is the
      // state the server is in. Keep the lock; there is nothing to tell the user.
      if (error instanceof ApiError && error.status === 409) return;
      // Anything else: a filled heart with no row behind it is a silent lie.
      // Unlock and say so.
      if (previous === undefined) delete store.reactions[id];
      else store.reactions[id] = previous;
      toast.error((error as Error).message);
    } finally {
      pending.value = false;
    }
  }

  return { reaction, isLiked, isDisliked, isLocked, react };
}
