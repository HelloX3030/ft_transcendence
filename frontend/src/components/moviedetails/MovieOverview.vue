<script setup lang="ts">
defineProps<{
  overview: string;
}>();
</script>

<template>
  <div class="px-6 mt-4">
    <p class="text-sm text-zinc-300 leading-relaxed">{{ overview }}</p>
  </div>
</template>
