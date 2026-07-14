<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import LoginHero from '@/components/auth/LoginHero.vue';
import SignupForm from '@/components/auth/SignupForm.vue';
import { Separator } from '@/components/ui/separator';
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="flex flex-1 h-full">
    <section class="hidden lg:flex flex-1 items-center justify-center p-12">
      <LoginHero />
    </section>

    <Separator orientation="vertical" />

    <section class="flex flex-1 items-center justify-center p-8">
      <Card class="w-full min-h-3/4 max-w-sm md:max-w-lg lg:max-w-2xl my-4 md:my-12 justify-evenly">
        <CardHeader class="text-center">
          <CardTitle class="text-3xl">Create your Account</CardTitle>
          <CardDescription>Join the hunt for your next favorite movie.</CardDescription>
        </CardHeader>

        <CardContent>
          <SignupForm />
        </CardContent>
        <CardFooter class="flex justify-center gap-2">
          <p class="text-muted-foreground">Already have an account?</p>
          <RouterLink to="/login" class="text-primary hover:underline">Login</RouterLink>
        </CardFooter>
      </Card>
    </section>
  </div>
</template>
