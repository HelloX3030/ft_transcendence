<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { registerSchema } from '@/lib/schemas';
import { ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';

import GoogleButton from './GoogleButton.vue';
import PasswordInput from './PasswordInput.vue';
import { ApiError } from '@/api/api-error';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';

const form = useForm({
  validationSchema: toTypedSchema(registerSchema),
});

const router = useRouter();
const auth = useAuthStore();
const userStore = useUserStore();
const errorMessage = ref<string | null>(null);

const passwordInput = useTemplateRef('passwordInput');
const confirmPasswordInput = useTemplateRef('confirmPasswordInput');

const onSubmit = form.handleSubmit(async ({ username, email, password }) => {
  errorMessage.value = null;
  // A rejected signup re-renders this form with both passwords still in it.
  passwordInput.value?.mask();
  confirmPasswordInput.value?.mask();
  try {
    await auth.register({ username, email, password });
    await userStore.refetchUser();
    router.push('/');
  } catch (err: unknown) {
    if (!(err instanceof ApiError)) {
      errorMessage.value = 'Could not reach the server.';
    } else if (err.status === 409) {
      errorMessage.value = 'Email or username is already taken.';
    } else {
      errorMessage.value = err.message || 'Something went wrong. Please try again.';
    }
  }
});
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
    <FormField v-slot="{ componentField }" name="username">
      <FormItem>
        <FormLabel>Username</FormLabel>
        <FormControl>
          <Input
            v-bind="componentField"
            type="text"
            autocomplete="nickname"
            placeholder="urbi420"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <FormField v-slot="{ componentField }" name="email" type="email">
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input
            v-bind="componentField"
            type="email"
            autocomplete="email"
            placeholder="email@cinemates.de"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <FormField v-slot="{ componentField }" name="password">
      <FormItem>
        <FormLabel>Password</FormLabel>
        <FormControl>
          <PasswordInput ref="passwordInput" v-bind="componentField" autocomplete="new-password" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <FormField v-slot="{ componentField }" name="confirmPassword">
      <FormItem>
        <FormLabel>Confirm Password</FormLabel>
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

    <div class="mt-8 flex flex-col space-y-4">
      <p v-if="errorMessage" class="text-sm text-destructive text-center">{{ errorMessage }}</p>
      <Button type="submit" class="w-full">Create Account</Button>
      <!-- Same endpoint as the login page: with the callback's resolution order,
           "sign up with Google" and "sign in with Google" are one flow. -->
      <GoogleButton />
    </div>
  </form>
</template>
