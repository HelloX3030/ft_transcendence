<script setup lang="ts">
import LoginForm from '@/components/auth/LoginForm.vue';
import LoginHero from '@/components/auth/LoginHero.vue';

import { Separator } from '@/components/ui/separator';
</script>

<template>
  <div class="flex flex-1 h-full">
    <section class="hidden lg:flex flex-1 items-center justify-center p-12">
      <LoginHero />
    </section>

    <Separator orientation="vertical" />

    <section class="flex flex-1 items-center justify-center p-8">
      <LoginForm />
    </section>
  </div>
</template>
