import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { TmdbPerson } from '@trailertinder/shared';
import { backendClient } from '@/api';
import { logger } from '@/lib/logger';

// Resolves TMDB person ids (a user's favorite actors/directors) to names. Unlike
// the genre catalogue there's no "fetch all" — people are looked up by id and
// accumulated in a shared cache, so overlapping lists reuse what's already loaded.
export const usePeopleStore = defineStore('people', () => {
  // id -> resolved person, accumulated across lookups.
  const people = ref<Record<number, TmdbPerson>>({});

  // De-dupes concurrent lookups of the same id onto a single in-flight request.
  const inFlight = new Map<number, Promise<void>>();

  function personName(id: number): string | undefined {
    return people.value[id]?.name;
  }

  // Fetches only the ids not already cached or in flight; resolves once every
  // requested id has been attempted, so callers can read names right after.
  async function ensureLoaded(ids: number[]): Promise<void> {
    const unique = [...new Set(ids)];
    const toFetch = unique.filter((id) => people.value[id] === undefined && !inFlight.has(id));

    if (toFetch.length > 0) {
      const request = backendClient<TmdbPerson[]>(`/tmdb/people?ids=${toFetch.join(',')}`)
        .then((data) => {
          for (const person of data) people.value[person.id] = person;
        })
        .catch((error) => {
          logger.error(error);
        })
        .finally(() => {
          for (const id of toFetch) inFlight.delete(id);
        });
      for (const id of toFetch) inFlight.set(id, request);
    }

    await Promise.all(
      unique.map((id) => inFlight.get(id)).filter((p): p is Promise<void> => p !== undefined),
    );
  }

  function $reset() {
    people.value = {};
  }

  return { people, personName, ensureLoaded, $reset };
});
