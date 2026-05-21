<script setup lang="ts">
import Hero from '@/components/Hero.vue';
import SignupForm from '@/components/SignupForm.vue';

import { Separator } from '@/components/ui/separator';
</script>

<template>
  <div class="flex h-full">
    <Hero />
    <Separator orientation="vertical" />
    <SignupForm />
  </div>
</template>
