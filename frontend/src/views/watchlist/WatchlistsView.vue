<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useFetch } from '@/composables/useFetch.ts';
import OverviewMobile from '@/components/watchlist/OverviewMobile.vue';
import OverviewDesktop from '@/components/watchlist/OverviewDesktop.vue';
import { Button } from '@/components/ui/button';

const { fetchPopular, popularMovies } = useFetch();

onMounted(fetchPopular);

function shuffle() {
  //   set the index to the arrays length
  const arr = [...posters.value];
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
  <section class="flex-1 p-8">
    <div class="max-w-5/6 mx-auto">
      <div class="flex justify-between items-center">
        <h1 class="text-3xl mb-6 font-bold">Your lists</h1>
        <Button variant="outline">+ New</Button>
      </div>
      <div class="hidden md:flex md:flex-col gap-4">
        <OverviewDesktop title="Watch Later" :movies="popularMovies" />
        <OverviewDesktop title="Likes" :movies="popularMovies" />
        <OverviewDesktop title="Horror" :movies="popularMovies" />
      </div>

      <div class="space-y-4 md:hidden">
        <OverviewMobile title="Watch Later" :posters="posters" :size="popularMovies.length" />
        <Overview
          title="Favorites 2016"
          :posters="shuffle()"
          :size="popularMovies.length"
          description="Alles was ich 2016 geguckt habe"
        />

        <OverviewMobile
          title="Kino Realeases 2026"
          :posters="shuffle()"
          :size="popularMovies.length"
        />

        <OverviewMobile title="Feel Good" :posters="shuffle()" :size="popularMovies.length" />
      </div>
    </div>
  </section>
</template>
