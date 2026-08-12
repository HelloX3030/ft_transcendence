import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue';
import { toast } from 'vue-sonner';
import { moviesApi } from '@/api';
import { ApiError } from '@/api/api-error';
import type { ReactionType } from '@cinemates/shared';

/**
 * Like / dislike for one trailer.
 *
 * A reaction is permanent: the recommendation service accumulates it into the
 * user's taste profile and has no message that takes one back, so an interface
 * that offered a toggle would promise a reversibility the system does not have.
 * Both buttons therefore lock on the first click and stay locked.
 *
 * Lives here rather than in `Controls.vue` because the test suite runs in the
 * `node` environment with no `@vue/test-utils`, so component behaviour can only
 * be covered when it is held outside the component.
 */
export function useTrailerReaction(tmdbId: MaybeRefOrGetter<number>) {
  // null = no reaction yet. Once set, it returns to null only on failure.
  const reaction = ref<ReactionType | null>(null);
  const pending = ref(false);

  const isLiked = computed(() => reaction.value === 'like');
  const isDisliked = computed(() => reaction.value === 'dislike');
  const isLocked = computed(() => reaction.value !== null || pending.value);

  async function react(next: ReactionType) {
    // One reaction per movie, ever — and this is also what makes a double-click
    // safe, since the second click is dropped here rather than reaching the
    // server.
    if (isLocked.value) return;

    reaction.value = next; // optimistic: fills and locks both buttons
    pending.value = true;
    try {
      await moviesApi.setReaction(toValue(tmdbId), next);
    } catch (error) {
      // 409 means a row already exists — the state we were asking for is the
      // state the server is in. Keep the lock; there is nothing to tell the user.
      if (error instanceof ApiError && error.status === 409) return;
      // Anything else: a filled heart with no row behind it is a silent lie.
      // Unlock and say so.
      reaction.value = null;
      toast.error((error as Error).message);
    } finally {
      pending.value = false;
    }
  }

  return { reaction, isLiked, isDisliked, isLocked, react };
}
