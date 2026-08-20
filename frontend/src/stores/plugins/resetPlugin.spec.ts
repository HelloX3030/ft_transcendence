import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { createApp, ref } from 'vue';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn() } }));

const { resetPlugin, resetAllStores } = await import('./resetPlugin');

/**
 * Logging out clears every store in one pass, and a store that cannot reset must
 * not abort it: Pinia gives a setup store a $reset stub that throws, which a `?.`
 * call does not skip, so an unguarded throw would escape logout() and leave every
 * later store holding the previous session's state.
 */
describe('resetAllStores', () => {
  beforeEach(() => {
    const pinia = createPinia();
    pinia.use(resetPlugin);
    // Pinia only runs plugins once the instance is installed on an app:
    // pinia.use() alone leaves them queued and every store resets to nothing.
    createApp({}).use(pinia);
    setActivePinia(pinia);
  });

  it('resets every store that can be reset', () => {
    const a = defineStore('a', () => {
      const value = ref(1);
      function $reset() {
        value.value = 0;
      }
      return { value, $reset };
    })();
    const b = defineStore('b', () => {
      const value = ref(2);
      function $reset() {
        value.value = 0;
      }
      return { value, $reset };
    })();

    resetAllStores();

    expect(a.value).toBe(0);
    expect(b.value).toBe(0);
  });

  it('keeps going when one store cannot reset', () => {
    // A setup store with no $reset of its own, Pinia's stub throws on call.
    defineStore('broken', () => ({ value: ref(1) }))();
    const later = defineStore('later', () => {
      const value = ref(2);
      function $reset() {
        value.value = 0;
      }
      return { value, $reset };
    })();

    expect(() => resetAllStores()).not.toThrow();
    // Registered after the broken one, so it is the store a propagating throw
    // would have skipped.
    expect(later.value).toBe(0);
  });
});
