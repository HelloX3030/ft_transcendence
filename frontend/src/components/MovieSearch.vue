<script setup lang="ts">
import { Search, X } from '@lucide/vue';
import { InputGroup, InputGroupAddon, InputGroupInput } from './ui/input-group';
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { Spinner } from './ui/spinner';
import { useMoviesStore } from '@/stores/movies';
import { Button } from './ui/button';

const store = useMoviesStore();
const { searchStatus, searchTotal } = storeToRefs(store);

const inputQuery = ref('');

// A freshly mounted search box (empty input) starts a fresh session, results
// from a previous view must not leak into this one.
onMounted(store.resetSearch);
</script>

<template>
  <form @submit.prevent="store.search(inputQuery)">
    <InputGroup class="px-4">
      <InputGroupAddon>
        <Button type="submit" :variant="null" class="hover:text-primary" size="icon">
          <Search />
        </Button>
      </InputGroupAddon>
      <InputGroupInput placeholder="Search..." v-model="inputQuery" />
      <InputGroupAddon align="inline-end"
        ><Spinner v-if="searchStatus === 'loading'" />
        <span v-else-if="searchStatus === 'ready'" v-show="searchTotal > 0"
          >{{ searchTotal }} results
        </span>
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        <Button
          type="button"
          :variant="null"
          class="hover:text-primary"
          size="icon"
          :disabled="inputQuery === ''"
          @click="
            () => {
              inputQuery = '';
              store.resetSearch();
            }
          "
        >
          <X />
        </Button>
      </InputGroupAddon>
    </InputGroup>
  </form>
</template>
