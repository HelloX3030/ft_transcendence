<script setup lang="ts">
import { Search } from 'lucide-vue-next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { InputGroup, InputGroupInput } from './ui/input-group';
import { ref } from 'vue';
import { Spinner } from './ui/spinner';
import MovieCard from './MovieCard.vue';

const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: '1', //TODO: api key
  },
};

async function search() {
  try {
    isLoading.value = 'loading';
    console.log(inputQuery.value);
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${inputQuery.value}&include_adult=false&language=en-US&page=1`,
      options,
    );
    const data = await res.json();
    isLoading.value = 'finish';
    console.log(data.results);
    searchedMovies.value = data.results;
  } catch (error) {
    console.error(error);
    isLoading.value = 'error';
  }
}

const inputQuery = ref('');
const isLoading = ref<'loading' | 'pending' | 'finish' | 'error'>('pending');
const searchedMovies = ref([]);
</script>

<template>
  <form @submit.prevent="search">
    <InputGroup class="px-4">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search..." v-model="inputQuery" />
      <InputGroupAddon
        ><Spinner v-if="isLoading === 'loading'" />
        <span v-else-if="isLoading === 'finish'">{{ searchedMovies.length }} </span>
      </InputGroupAddon>
    </InputGroup>
  </form>
  <div class="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
    <MovieCard
      v-for="{ title, poster_path, id } in searchedMovies"
      :key="id"
      :title="title"
      :img="poster_path"
      :selected="false"
    />
  </div>
</template>
