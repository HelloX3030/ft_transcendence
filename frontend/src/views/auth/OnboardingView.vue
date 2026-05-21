<script setup lang="ts">
import MovieCard from '@/components/MovieCard.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { popular } from '@/lib/test';
import { Search } from 'lucide-vue-next';
import { ref } from 'vue';

const progress = ref(0);
const step = ref(0);
</script>

<template>
  <div class="flex flex-col flex-1 p-8 gap-4">
    <div class="">
      <h1 class="text-4xl">Pick your Top 10</h1>
      <p class="text-muted-foreground">
        We'll use these to find your perfect movie trailers and refine your feed.
      </p>
    </div>
    <div class="flex gap-2">
      <Input placeholder="Search movie..." />
      <Button><Search /></Button>
    </div>
    <div class="flex items-center justify-between">
      <span>Selected({{ 0 }}/10)</span>
      <Progress :model-value="progress" class="w-1/3" />
    </div>
    <div class="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
      <MovieCard
        v-for="{ title, poster_path } in popular"
        :key="title"
        :title="title"
        :img="poster_path"
        :selected="false"
      />
    </div>
  </div>
</template>
