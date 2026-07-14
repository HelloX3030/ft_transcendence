<script setup lang="ts">
import LoginForm from '@/components/auth/LoginForm.vue';
import LoginHero from '@/components/auth/LoginHero.vue';
import OtpForm from '@/components/auth/OtpForm.vue';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Separator } from '@/components/ui/separator';
import { useLogin } from '@/composables/useLogin';
import { RouterLink } from 'vue-router';

const { mfaRequired, errorMessage, otpVerifyLoading, login, verifyOtp, resetOtp } = useLogin();
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
          <CardTitle class="text-3xl">Welcome Back</CardTitle>
          <CardDescription>Your next obsession is just a swipe away.</CardDescription>
        </CardHeader>

        <CardContent>
          <LoginForm v-if="!mfaRequired" :error="errorMessage" @submit="login" />
          <OtpForm
            v-else
            :error="errorMessage"
            :loading="otpVerifyLoading"
            @verify="verifyOtp"
            @back="resetOtp"
          />
        </CardContent>

        <CardFooter class="flex flex-col gap-2">
          <div class="flex items-center space-x-2">
            <p class="text-muted-foreground">Don't have an account?</p>
            <RouterLink to="/signup" class="text-primary hover:underline">Sign Up</RouterLink>
          </div>
        </CardFooter>
      </Card>
    </section>
  </div>
</template>
