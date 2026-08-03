<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { registerSchema } from '@/lib/schemas';
import { Eye, EyeOff } from '@lucide/vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import GoogleButton from './GoogleButton.vue';
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

const onSubmit = form.handleSubmit(async ({ username, email, password }) => {
  errorMessage.value = null;
  try {
    await auth.register({ username, email, password, language: 'de' }); //TODO: dynamic language
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

const isPwVisible = ref(false);
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
        <div class="flex justify-between">
          <FormLabel>Password</FormLabel>
          <Button variant="ghost" type="button" @click="isPwVisible = !isPwVisible">
            <EyeOff v-if="isPwVisible" />
            <Eye v-else />
          </Button>
        </div>

        <FormControl>
          <div class="flex items-center gap-2">
            <Input
              v-bind="componentField"
              :type="isPwVisible ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄"
            >
            </Input>
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <FormField v-slot="{ componentField }" name="confirmPassword">
      <FormItem>
        <FormLabel>Confirm Password</FormLabel>
        <FormControl>
          <Input
            v-bind="componentField"
            type="password"
            autocomplete="new-password"
            placeholder="🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄"
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
