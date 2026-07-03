<script setup lang="ts">
import { useSearchFilter } from '@/composables/useSearchFilter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const { yearFrom, yearTo } = useSearchFilter();

const currentYear = new Date().getFullYear();
</script>

<template>
  <div class="flex items-center gap-2 rounded-lg px-3 py-1.5 shadow-sm">
    <Label class="text-sm text-muted-foreground whitespace-nowrap">From</Label>
    <Input
      v-model.number="yearFrom"
      type="number"
      :min="1900"
      :max="currentYear"
      placeholder="—"
      class="w-20 h-8"
    />

    <Label class="text-sm text-muted-foreground whitespace-nowrap">to</Label>
    <Input
      v-model.number="yearTo"
      type="number"
      :min="1900"
      :max="currentYear"
      placeholder="2026"
      class="w-20 h-8"
    />
  </div>
</template>
