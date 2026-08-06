<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <p class="text-muted-foreground text-center text-xs">
    <RouterLink to="/terms" class="hover:underline">Terms of Service</RouterLink>
    ·
    <RouterLink to="/privacy" class="hover:underline">Privacy Policy</RouterLink>
  </p>
</template>
