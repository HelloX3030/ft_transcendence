<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import OtpForm from '@/components/auth/OtpForm.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth';

/**
 * Where the Google callback lands. It exists so the session cookies are never
 * asked for on a cross-site navigation: this route renders from the Vite shell
 * without authentication, then calls /auth/me as a same-origin fetch, where the
 * `sameSite: 'strict'` cookies are sent normally.
 */
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const errorMessage = ref<string | null>(null);
const mfaRequired = ref(false);
const otpVerifyLoading = ref(false);

/**
 * The callback can only report failure through the URL, so the backend sends a
 * code and the copy lives here. A raw code or an upstream string is never shown.
 */
const GENERIC_ERROR = 'Google sign-in failed. Please try again.';

const ERROR_COPY: Record<string, string> = {
  email_taken: 'An account with this email already exists. Log in with your password instead.',
  unverified_email: 'Google has not verified this email address.',
  state_mismatch: 'That login attempt expired. Please try again.',
  provider_error: GENERIC_ERROR,
};

onMounted(async () => {
  const error = route.query.error;
  if (typeof error === 'string') {
    errorMessage.value = ERROR_COPY[error] ?? GENERIC_ERROR;
    return;
  }

  // The account has TOTP enabled, so a Google login is not enough on its own.
  // The challenge token is in an httpOnly cookie the browser sends with the
  // verify call — it is deliberately not readable here.
  if (route.query.mfa === '1') {
    mfaRequired.value = true;
    return;
  }

  await finishLogin();
});

async function finishLogin() {
  // False means the session cookies did not survive the redirect — the one
  // failure this route's whole design exists to avoid, so it is worth showing
  // rather than looping back to /login silently.
  if (!(await authStore.completeOAuthLogin())) {
    errorMessage.value = GENERIC_ERROR;
    return;
  }
  // `replace`, so the callback URL does not sit in history behind the user.
  await router.replace('/');
}

async function verifyOtp(otp: string) {
  errorMessage.value = null;
  otpVerifyLoading.value = true;
  try {
    // No mfaToken: the cookie carries it.
    await authStore.verifyMfa({ otp });
    await router.replace('/');
  } catch {
    errorMessage.value = 'Invalid or expired code. Please try again.';
  } finally {
    otpVerifyLoading.value = false;
  }
}
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-8">
    <Card class="w-full max-w-sm md:max-w-md">
      <CardHeader class="text-center">
        <CardTitle class="text-2xl">
          {{ mfaRequired ? 'Two-factor authentication' : 'Signing you in' }}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <OtpForm
          v-if="mfaRequired"
          :error="errorMessage"
          :loading="otpVerifyLoading"
          @verify="verifyOtp"
          @back="router.replace('/login')"
        />

        <div v-else-if="errorMessage" class="space-y-6">
          <p class="text-sm text-destructive text-center">{{ errorMessage }}</p>
          <Button class="w-full" @click="router.replace('/login')">Back to login</Button>
        </div>

        <p v-else class="text-muted-foreground text-sm text-center">One moment…</p>
      </CardContent>
    </Card>
  </div>
</template>
