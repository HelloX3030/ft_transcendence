<script setup lang="ts">
import { ref } from 'vue';
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from '@/components/ui/tags-input';
import { Label } from '@/components/ui/label';

const modelValue = ref(['Apple', 'Banana']);
</script>

<template>
  <div class="grid gap-3">
    <Label for="movies">Movies</Label>
    <TagsInput id="movies" v-model="modelValue" class="">
      <TagsInputItem v-for="item in modelValue" :key="item" :value="item">
        <TagsInputItemText />
        <TagsInputItemDelete />
      </TagsInputItem>
      <TagsInputInput placeholder="Movies..." />
    </TagsInput>
  </div>
</template>
