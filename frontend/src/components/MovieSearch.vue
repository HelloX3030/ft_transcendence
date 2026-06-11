<script setup lang="ts">
import { Search } from 'lucide-vue-next';
import { InputGroup, InputGroupInput } from './ui/input-group';
import { onMounted, ref } from 'vue';
import { Spinner } from './ui/spinner';
import { useFetch } from '@/composables/useFetch';

const { searchMovies, resetSearch, searchedMovies, isLoading } = useFetch();

const inputQuery = ref('');

// A freshly mounted search box (empty input) starts a fresh session — results
// from a previous view must not leak into this one.
onMounted(resetSearch);
</script>

<template>
  <form @submit.prevent="searchMovies(inputQuery)">
    <InputGroup class="px-4">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search..." v-model="inputQuery" />
      <InputGroupAddon
        ><Spinner v-if="isLoading === 'loading'" />
        <span v-else-if="isLoading === 'finish'" v-show="searchedMovies.length > 0"
          >{{ searchedMovies.length }} Results
        </span>
      </InputGroupAddon>
    </InputGroup>
  </form>
</template>
