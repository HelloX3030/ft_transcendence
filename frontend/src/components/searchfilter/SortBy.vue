<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select/index.ts';

import { useSearchFilter } from '@/composables/useSearchFilter.ts';

const { sortOptions, sortField } = useSearchFilter();
</script>

<template>
  <Select v-model="sortField">
    <SelectTrigger class="w-40">
      <SelectValue placeholder="Sort by" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-for="option in sortOptions"
        :key="option"
        :value="option"
        @click="sortField = option"
      >
        {{ option.replace('_', ' ').toUpperCase() }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
