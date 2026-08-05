<script lang="ts" setup>
import { useWatchlists } from '@/composables/watchlist/useWatchlists';
import { Spinner } from '@/components/ui/spinner/index.ts';
import WatchlistOverview from '@/components/watchlist/WatchlistOverview.vue';
import CreateListDialog from '@/components/watchlist/CreateListDialog.vue';
import { watchlistApi } from '@/api/index.ts';
import { useWatchlistsStore } from '@/stores/watchlists';

const { state: watchlists, isLoading, isReady, error } = useWatchlists();
const watchlistsStore = useWatchlistsStore();

async function deleteWatchlist(watchlistId: number) {
  await watchlistApi.delete(watchlistId);
  watchlistsStore.invalidate();
}
</script>

<template>
  <section class="flex-1 p-8 h-[calc(100vh-var(--header-height))]">
    <!-- A percentage cap alone still grows without limit on an ultrawide. -->
    <div class="w-5/6 max-w-[1600px] mx-auto h-full flex flex-col">
      <div class="flex justify-between items-center">
        <h1 class="text-3xl mb-6 font-bold">Your lists</h1>
        <CreateListDialog />
      </div>

      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <Spinner class="size-16" />
      </div>
      <div
        v-if="isReady && watchlists?.length == 0"
        class="flex items-center justify-center h-full"
      >
        <p class="text-zinc-500">No Watchlist</p>
      </div>
      <div v-else-if="error" class="flex items-center justify-center h-full">
        <p class="text-zinc-500">Couldn't load watchlists: {{ (error as Error).message }}</p>
      </div>

      <div v-else class="flex flex-col">
        <WatchlistOverview
          v-for="watchlist in watchlists"
          :key="watchlist.id"
          v-bind="watchlist"
          @delete="(id) => deleteWatchlist(id)"
        />
      </div>
    </div>
  </section>
</template>
