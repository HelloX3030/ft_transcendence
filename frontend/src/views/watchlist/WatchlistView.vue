<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useFetch } from '@/composables/useFetch.ts';
import WatchList from '@/components/watchlist/WatchList.vue';
import Overview from '@/components/watchlist/Overview.vue';
import { Separator } from '@/components/ui/separator';

const { fetchPopular, popularMovies } = useFetch();

onMounted(fetchPopular);

function shuffle() {
  //   set the index to the arrays length
  const arr = posters;
  let i = posters.value.length,
    j,
    temp;
  while (--i > 0) {
    j = Math.floor(Math.random() * (i + 1));
    temp = arr[j];
    arr[j] = arr[i];
    arr[i] = temp;
  }
  return arr;
}

const posters = computed(() => {
  return popularMovies.value.map((movie) => ({ img: movie.poster_path })).splice(0, 5);
});
</script>

<template>
  <section class="flex-1 p-8 space-y-2">
    <h1 class="text-3xl">Your lists</h1>
    <!-- <WatchList title="Watch Later" :movies="popularMovies" />
    <WatchList title="Likes" :movies="popularMovies" />
    <WatchList title="Horror" :movies="popularMovies" /> -->

    <Overview title="Watch Later" :posters="posters" :size="popularMovies.length" />
    <Separator />
    <Overview
      title="Favorites 2016"
      :posters="shuffle(posters)"
      :size="popularMovies.length"
      description="Alles was ich 2016 geguckt habe"
    />
    <Separator />

    <Overview
      title="Kino Realeases 2026"
      :posters="shuffle(posters)"
      :size="popularMovies.length"
    />
    <Separator />

    <Overview title="Feel Good" :posters="shuffle(posters)" :size="popularMovies.length" />
  </section>
</template>
