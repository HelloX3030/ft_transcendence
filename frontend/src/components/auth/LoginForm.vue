<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Separator } from '@/components/ui/separator';
import { RouterLink } from 'vue-router';
import { loginSchema } from '@/lib/schemas';
import { useAuthStore } from '@/stores/auth';

const form = useForm({
  validationSchema: toTypedSchema(loginSchema),
});

const router = useRouter();
const auth = useAuthStore();
const errorMessage = ref<string | null>(null);

// Zwischenzustand: Passwort korrekt, aber TOTP-Code noch nötig
const mfaRequired = ref(false);
const otpValue = ref('');
const isVerifyingOtp = ref(false);

// Credentials merken, damit wir sie im zweiten Schritt erneut mitschicken können
const pendingEmail = ref('');
const pendingPassword = ref('');

const onSubmit = form.handleSubmit(async ({ email, password }) => {
  errorMessage.value = null;
  try {
    const result = await auth.login({ email, password });
    if (result.mfaRequired) {
      pendingEmail.value = email;
      pendingPassword.value = password;
      mfaRequired.value = true;
    } else {
      router.push('/');
    }
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e?.status === 403) {
      errorMessage.value = 'Invalid email or password.';
    } else if (e?.status) {
      errorMessage.value = e.message ?? 'Something went wrong. Please try again.';
    } else {
      errorMessage.value = 'Could not reach the server.';
    }
  }
});

async function handleOtpVerify() {
  if (otpValue.value.length !== 6) return;
  errorMessage.value = null;
  isVerifyingOtp.value = true;
  try {
    const result = await auth.login({
      email: pendingEmail.value,
      password: pendingPassword.value,
      otp: otpValue.value,
    });
    if (!result.mfaRequired) {
      router.push('/');
    }
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    errorMessage.value =
      e?.status === 403
        ? 'Invalid code. Please try again.'
        : 'Something went wrong. Please try again.';
    otpValue.value = '';
  } finally {
    isVerifyingOtp.value = false;
  }
}

function handleBackToLogin() {
  mfaRequired.value = false;
  otpValue.value = '';
  errorMessage.value = null;
  pendingPassword.value = '';
}
</script>

<template>
  <Card class="w-full min-h-3/4 max-w-sm md:max-w-lg lg:max-w-2xl my-4 md:my-12 justify-evenly">
    <CardHeader class="text-center">
      <CardTitle class="text-3xl">Welcome Back</CardTitle>
      <CardDescription> Your next obsession is just a swipe away.</CardDescription>
    </CardHeader>

    <CardContent class="">
      <form v-if="!mfaRequired" @submit.prevent="onSubmit" class="space-y-6">
        <FormField v-slot="{ componentField }" name="email">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                type="email"
                autocomplete="username"
                placeholder="email@cinemates.de"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="password">
          <FormItem>
            <div class="flex items-center justify-between">
              <FormLabel>Password</FormLabel>
              <!-- TODO: forgot password logic -->
              <Button type="button" variant="link" class="">Forgot password?</Button>
            </div>
            <FormControl>
              <Input
                v-bind="componentField"
                type="password"
                autocomplete="current-password"
                placeholder="🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <div class="mt-8 flex flex-col space-y-8">
          <p v-if="errorMessage" class="text-sm text-destructive text-center">{{ errorMessage }}</p>
          <Button type="submit" class="w-full"> Login </Button>
          <div class="w-full flex items-center gap-2">
            <Separator class="flex-1" />
            <span class="shrink-0 px-2 text-xs text-muted-foreground uppercase"> OR </span>
            <Separator class="flex-1" />
          </div>
          <!-- TODO: oauth implementation -->
          <Button type="button" variant="outline" class="w-full"
            ><img src="/google_icon.svg" class="size-6" /> Continue with Google
          </Button>
        </div>
      </form>

      <div v-else class="space-y-6">
        <div class="flex flex-col items-center gap-4">
          <p class="text-muted-foreground text-sm text-center">
            Enter the 6-digit code from your authenticator app.
          </p>
          <InputOTP v-model="otpValue" :maxlength="6" @complete="handleOtpVerify">
            <InputOTPGroup>
              <InputOTPSlot :index="0" />
              <InputOTPSlot :index="1" />
              <InputOTPSlot :index="2" />
              <InputOTPSlot :index="3" />
              <InputOTPSlot :index="4" />
              <InputOTPSlot :index="5" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive text-center">{{ errorMessage }}</p>

        <div class="flex flex-col space-y-4">
          <Button
            type="button"
            class="w-full"
            :disabled="otpValue.length !== 6 || isVerifyingOtp"
            @click="handleOtpVerify"
          >
            {{ isVerifyingOtp ? 'Verifying...' : 'Verify' }}
          </Button>
          <Button type="button" variant="link" @click="handleBackToLogin">Back to login</Button>
        </div>
      </div>
    </CardContent>

    <CardFooter class="flex flex-col gap-2">
      <div class="flex items-center space-x-2 text-nowrap">
        <p class="text-muted-foreground">Don't have an account?</p>
        <RouterLink to="/signup" class="text-primary hover:underline">Sign Up</RouterLink>
      </div>
    </CardFooter>
  </Card>
</template>
