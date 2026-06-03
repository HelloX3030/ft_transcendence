<script setup lang="ts">
import { Search } from 'lucide-vue-next';
import { InputGroup, InputGroupAddon, InputGroupInput } from './ui/input-group';
import { ref } from 'vue';
import { Spinner } from './ui/spinner';
import { useFetch } from '@/composables/useFetch';
import { Button } from './ui/button';
import { X } from '@lucide/vue';

const { searchMovies, searchedMovies, isLoading } = useFetch();

const inputQuery = ref('');
</script>

<template>
  <form @submit.prevent="searchMovies(inputQuery)">
    <InputGroup class="px-4">
      <InputGroupAddon>
        <Button type="submit" :variant="null" class="hover:text-primary" size="icon">
          <Search />
        </Button>
      </InputGroupAddon>
      <InputGroupInput placeholder="Search..." v-model="inputQuery" />
      <InputGroupAddon v-show="inputQuery" align="inline-end">
        <Button :variant="null" class="hover:text-primary" size="icon" @click="inputQuery = ''">
          <X />
        </Button>
      </InputGroupAddon>
      <InputGroupAddon align="inline-end"
        ><Spinner v-if="isLoading === 'loading'" />
        <span v-else-if="isLoading === 'finish'" v-show="searchedMovies.length > 0"
          >{{ searchedMovies.length }} Results
        </span>
      </InputGroupAddon>
    </InputGroup>
  </form>
</template>
