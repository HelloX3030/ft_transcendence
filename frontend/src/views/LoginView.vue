<script setup lang="ts">
import Hero from '@/components/Hero.vue';
import LoginForm from '@/components/LoginForm.vue';

import { Separator } from '@/components/ui/separator';
</script>

<template>
  <div class="flex h-full">
    <Hero />
    <Separator orientation="vertical" />
    <LoginForm />
  </div>
</template>
