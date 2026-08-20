import type { PiniaPluginContext } from 'pinia';
import { logger } from '@/lib/logger';

const resettableStores = new Set<{ $id: string; $reset?: () => void }>();

export function resetPlugin({ store }: PiniaPluginContext) {
  resettableStores.add(store);
}

export function resetAllStores() {
  for (const store of resettableStores) {
    try {
      store.$reset?.();
    } catch (error) {
      // Pinia defines $reset on a setup store as a stub that throws, so `?.`
      // does not guard a store that forgot to write one. Left unhandled, the
      // throw escapes logout() and every later store keeps its state.
      logger.error(`[reset] store "${store.$id}" could not be reset`, error);
    }
  }
}
