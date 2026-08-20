<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import { ApiError } from '@/api/api-error';
import { authApi } from '@/api/endpoints/auth';
import { resetPasswordSchema } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuthStore } from '@/stores/auth';
import LegalFooter from '@/components/auth/LegalFooter.vue';
import PasswordInput from '@/components/auth/PasswordInput.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : null));

const loading = ref(false);
const errorMessage = ref<string | null>(null);
/** Set once the backend answers 403 mfaRequired, never guessed up front, because
 *  that would mean asking the server whether an account has 2FA before the token
 *  has been shown to be valid. */
const mfaRequired = ref(false);
const otp = ref('');

const form = useForm({
  validationSchema: toTypedSchema(resetPasswordSchema),
});

const passwordInput = useTemplateRef('passwordInput');
const confirmPasswordInput = useTemplateRef('confirmPasswordInput');

const onSubmit = form.handleSubmit(async ({ password }) => {
  // The 2FA branch below re-renders this form with both passwords still in it.
  passwordInput.value?.mask();
  confirmPasswordInput.value?.mask();
  if (token.value === null) return;
  if (mfaRequired.value && otp.value.length !== 6) {
    errorMessage.value = 'Enter the 6-digit code from your authenticator app.';
    return;
  }

  loading.value = true;
  errorMessage.value = null;
  try {
    await authApi.resetPassword({
      token: token.value,
      password,
      ...(mfaRequired.value ? { otp: otp.value } : {}),
    });
    // Deliberately not logged in: the user proves the new password works by
    // using it. Only the session cookies would say otherwise.
    //
    // The backend has just revoked every session, so a signed-in visitor's
    // isLoggedIn is stale; left alone, guestOnly on /login would bounce them
    // straight back into a session that no longer exists.
    auth.clearSession();
    await router.replace('/login');
  } catch (err: unknown) {
    if (!(err instanceof ApiError)) {
      errorMessage.value = 'Could not reach the server. Please try again.';
    } else if (err.status === 403 && !mfaRequired.value) {
      // First time through: the link is valid, the account just has 2FA.
      mfaRequired.value = true;
      errorMessage.value = 'This account uses two-factor authentication.';
    } else {
      errorMessage.value = err.message || 'Something went wrong.';
    }
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-8">
    <Card class="w-full max-w-sm md:max-w-md">
      <CardHeader class="text-center">
        <CardTitle class="text-2xl">Choose a new password</CardTitle>
        <CardDescription v-if="token !== null">
          Setting a new password signs you out everywhere else.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <!-- No token means there is nothing to submit; an empty form that fails
             on submit would be a worse way to say the same thing. -->
        <div v-if="token === null" class="space-y-6 text-center">
          <p class="text-sm text-destructive">
            This reset link is invalid or has expired. Request a new one to continue.
          </p>
          <Button class="w-full" @click="router.replace('/forgot-password')">
            Request a new link
          </Button>
        </div>

        <form v-else @submit.prevent="onSubmit" class="space-y-6">
          <FormField v-slot="{ componentField }" name="password">
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <PasswordInput
                  ref="passwordInput"
                  v-bind="componentField"
                  autocomplete="new-password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="confirmPassword">
            <FormItem>
              <FormLabel>Confirm new password</FormLabel>
              <FormControl>
                <PasswordInput
                  ref="confirmPasswordInput"
                  v-bind="componentField"
                  autocomplete="new-password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <div v-if="mfaRequired" class="space-y-2">
            <p class="text-sm font-medium">Authenticator code</p>
            <div class="flex justify-center">
              <InputOTP v-model="otp" :maxlength="6">
                <InputOTPGroup>
                  <InputOTPSlot v-for="i in 6" :key="i" :index="i - 1" />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <p v-if="errorMessage" class="text-sm text-destructive text-center">{{ errorMessage }}</p>

          <Button type="submit" class="w-full" :disabled="loading">
            {{ loading ? 'Saving…' : 'Set new password' }}
          </Button>
        </form>
      </CardContent>

      <CardFooter class="flex flex-col gap-2">
        <RouterLink to="/login" class="text-primary hover:underline text-sm">
          Back to login
        </RouterLink>
        <LegalFooter />
      </CardFooter>
    </Card>
  </div>
</template>
