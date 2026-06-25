<script setup lang="ts">
interface Props {
  backdropUrl: string;
  title: string;
}

defineProps<Props>();
</script>

<template>
  <div class="relative w-full h-80">
    <img :src="backdropUrl" :alt="title" class="w-full h-full object-cover object-top" />
    <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black" />
  </div>
</template>
