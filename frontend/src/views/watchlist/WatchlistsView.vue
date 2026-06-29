<script lang="ts" setup>
import { onMounted } from 'vue';
import { useWatchlist } from '@/composables/useWatchlist.ts';
import CreateListDialog from './CreateListDialog.vue';
import { Spinner } from '@/components/ui/spinner/index.ts';
import WatchlistOverview from '@/components/watchlist/WatchlistOverview.vue';

const { fetchAllWatchlists, watchlists, isLoading } = useWatchlist();

onMounted(fetchAllWatchlists);

// const posters = computed(() => {
//   return popularMovies.value.map((movie) => ({ img: movie.poster_path })).splice(0, 5);
// });
</script>

<template>
  <section class="flex-1 p-8">
    <div class="max-w-5/6 mx-auto">
      <div class="flex justify-between items-center">
        <h1 class="text-3xl mb-6 font-bold">Your lists</h1>
        <CreateListDialog />
      </div>

      <div v-if="isLoading === 'loading'" class="flex items-center justify-center min-h-screen">
        <Spinner class="size-16" />
      </div>
      <div
        v-if="isLoading === 'finish' && watchlists?.length == 0"
        class="flex items-center justify-center min-h-screen"
      >
        <p class="text-zinc-500">No Watchlist</p>
      </div>
      <div v-else-if="isLoading === 'error'" class="flex items-center justify-center min-h-screen">
        <p class="text-zinc-500">Error can not find Watchlists.</p>
      </div>

      <div v-else class="flex flex-col">
        <WatchlistOverview
          v-for="watchlist in watchlists"
          :key="watchlist.id"
          v-bind="watchlist"
          @edit="openEditDialog"
        />
      </div>
    </div>
  </section>
</template>
