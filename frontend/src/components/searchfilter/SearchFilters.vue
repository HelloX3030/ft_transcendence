<script setup lang="ts">
import YearRange from './YearRange.vue';
import SortBy from './SortBy.vue';
import SelectGenre from './SelectGenre.vue';
import SortOrder from './SortOrder.vue';
import SelectedFilters from './SelectedFilters.vue';
</script>

<template>
  <div class="flex gap-2 flex-wrap items-center">
    <SortBy />
    <SortOrder />
    <SelectGenre />
    <YearRange />
    <SelectedFilters />
  </div>
</template>
