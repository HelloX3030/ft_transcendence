<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import { useTemplateRef } from 'vue';
import { RouterLink } from 'vue-router';
import { loginSchema } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import GoogleButton from './GoogleButton.vue';
import PasswordInput from './PasswordInput.vue';

defineProps<{ error: string | null }>();
const emit = defineEmits<{ submit: [email: string, password: string] }>();

const form = useForm({
  validationSchema: toTypedSchema(loginSchema),
});

const passwordInput = useTemplateRef('passwordInput');

const onSubmit = form.handleSubmit(({ email, password }) => {
  // A rejected login re-renders this form with the password still in it.
  passwordInput.value?.mask();
  emit('submit', email, password);
});
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
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
          <RouterLink to="/forgot-password" class="text-primary hover:underline text-sm">
            Forgot password?
          </RouterLink>
        </div>
        <FormControl>
          <PasswordInput
            ref="passwordInput"
            v-bind="componentField"
            autocomplete="current-password"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="flex flex-col space-y-4">
      <p v-if="error" class="text-sm text-destructive text-center">{{ error }}</p>
      <Button type="submit" class="w-full">Login</Button>

      <GoogleButton />
    </div>
  </form>
</template>
