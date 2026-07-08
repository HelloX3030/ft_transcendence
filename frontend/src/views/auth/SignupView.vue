<script setup lang="ts">
import LoginHero from '@/components/auth/LoginHero.vue';

import SignupForm from '@/components/auth/SignupForm.vue';

import { Separator } from '@/components/ui/separator';
</script>

<template>
  <div class="flex flex-1 h-full">
    <section class="hidden lg:flex flex-1 items-center justify-center p-12">
      <LoginHero />
    </section>

    <Separator orientation="vertical" />

    <section class="flex flex-1 items-center justify-center p-8">
      <SignupForm />
    </section>
  </div>
</template>
