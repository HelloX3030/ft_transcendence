<script lang="ts" setup>
import { APP_NAME } from '@/lib/constants';
</script>

<template>
  <div class="flex flex-col h-full">
    <h1 class="text-4xl lg:text-6xl mb-16 text-center">
      <span class="text-primary">Experience</span> {{ APP_NAME }}
    </h1>
    <div class="relative flex-1 min-h-0">
      <img
        src="/inception.webp"
        alt=""
        class="rounded-2xl absolute h-[85%] w-auto max-w-none left-1/2 top-1/2 -translate-y-1/2 -translate-x-11/12 -rotate-12"
      />
      <img
        src="/city2.webp"
        alt=""
        class="rounded-2xl absolute h-[85%] w-auto max-w-none left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2"
      />
      <img
        src="/pulp.webp"
        alt=""
        class="rounded-2xl absolute h-[85%] w-auto max-w-none left-1/2 top-1/2 -translate-y-1/2 rotate-12"
      />
    </div>
    <p class="text-center md:text-xl lg:text-2xl p-8">
      The ultimate destination for movie enthusiasts to discover their next favorite story through
      curated cinematic snapshots.
    </p>
  </div>
</template>
