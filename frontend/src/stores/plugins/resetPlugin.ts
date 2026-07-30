import type { PiniaPluginContext } from 'pinia';

const resettableStores = new Set<{ $reset?: () => void }>();

export function resetPlugin({ store }: PiniaPluginContext) {
  resettableStores.add(store);
}

export function resetAllStores() {
  for (const store of resettableStores) {
    store.$reset?.();
  }
}
