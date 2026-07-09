<script setup lang="ts">
import { ref } from 'vue';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';
import { Search, X } from '@lucide/vue';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';

import { useUserSearch } from '@/composables/useUserSearch';

const { search, resetSearch, searchStatus } = useUserSearch();
const inputQuery = ref('');
</script>
<template>
  <form @submit.prevent="search({ query: inputQuery })">
    <InputGroup class="px-4">
      <InputGroupAddon>
        <Button type="submit" :variant="null" class="hover:text-primary" size="icon">
          <Search />
        </Button>
      </InputGroupAddon>
      <InputGroupInput placeholder="Search..." v-model="inputQuery" />
      <InputGroupAddon align="inline-end"
        ><Spinner v-if="searchStatus === 'loading'" />
        <!-- <span v-else-if="searchStatus === 'ready'" v-show="searchTotal > 0"
          >{{ searchTotal }} results
        </span> -->
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
              resetSearch();
            }
          "
        >
          <X />
        </Button>
      </InputGroupAddon>
    </InputGroup>
  </form>
</template>
