<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import { authApi } from '@/api/endpoints/auth';
import { forgotPasswordSchema } from '@/lib/schemas';
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
import { Input } from '@/components/ui/input';
import LegalFooter from '@/components/auth/LegalFooter.vue';

const submitted = ref(false);
const loading = ref(false);
const errorMessage = ref<string | null>(null);

const form = useForm({
  validationSchema: toTypedSchema(forgotPasswordSchema),
});

const onSubmit = form.handleSubmit(async ({ email }) => {
  loading.value = true;
  errorMessage.value = null;
  try {
    await authApi.forgotPassword({ email });
    // Shown for every address, including ones with no account. Branching here
    // would leak through the UI exactly what the endpoint refuses to say.
    submitted.value = true;
  } catch {
    // Only a transport failure or a 429 can land here; the endpoint answers 200
    // whether or not the account exists.
    errorMessage.value = 'Could not reach the server. Please try again.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-8">
    <Card class="w-full max-w-sm md:max-w-md">
      <CardHeader class="text-center">
        <CardTitle class="text-2xl">Forgot your password?</CardTitle>
        <CardDescription v-if="!submitted">
          Enter your email and we'll send you a link to set a new one.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div v-if="submitted" class="space-y-4 text-center">
          <p class="text-sm">If an account exists for that address, a reset link is on its way.</p>
          <p class="text-muted-foreground text-sm">
            The link is good for 30 minutes and can be used once.
          </p>
        </div>

        <form v-else @submit.prevent="onSubmit" class="space-y-6">
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

          <p v-if="errorMessage" class="text-sm text-destructive text-center">{{ errorMessage }}</p>

          <Button type="submit" class="w-full" :disabled="loading">
            {{ loading ? 'Sending…' : 'Send reset link' }}
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
