import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { ReactionType } from '@cinemates/shared';
import { moviesApi } from '@/api';
import { logger } from '@/lib/logger';

/**
 * The user's trailer reactions, by tmdbId. A store rather than state in each
 * player: a player is unmounted when its feed card leaves the window, the view
 * is left or the trailer modal closes, and the next one has to show the
 * reaction the server already holds.
 *
 * Absent = not known yet, null = known to have no reaction.
 */
export const useReactionsStore = defineStore('reactions', () => {
  const reactions = ref<Record<number, ReactionType | null>>({});
  const inFlight = new Map<number, Promise<void>>();
  // Bumped on reset, so an answer for the previous user is dropped.
  let generation = 0;

  /** The feed serves only unrated films, so its cards need no request. */
  function markUnreacted(tmdbIds: number[]): void {
    for (const id of tmdbIds) if (!(id in reactions.value)) reactions.value[id] = null;
  }

  /** Fetches a reaction at most once per session. */
  function ensureLoaded(tmdbId: number): Promise<void> {
    if (tmdbId in reactions.value) return Promise.resolve();
    const existing = inFlight.get(tmdbId);
    if (existing) return existing;

    const gen = generation;
    const request = moviesApi
      .getReaction(tmdbId)
      .then(({ reaction }) => {
        // A reaction given while this was in flight is newer than the answer.
        if (gen === generation && !(tmdbId in reactions.value)) {
          reactions.value[tmdbId] = reaction;
        }
      })
      .catch((error) => {
        // Left unknown so a later mount retries. Reacting still works: the
        // server answers 409 if a reaction already exists.
        logger.debug(error);
      })
      .finally(() => {
        if (inFlight.get(tmdbId) === request) inFlight.delete(tmdbId);
      });
    inFlight.set(tmdbId, request);
    return request;
  }

  function $reset(): void {
    generation++;
    reactions.value = {};
    inFlight.clear();
  }

  return { reactions, markUnreacted, ensureLoaded, $reset };
});
