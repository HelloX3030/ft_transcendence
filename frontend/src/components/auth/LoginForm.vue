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
import { z } from 'zod';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().nonempty(),
});

const form = useForm({
  validationSchema: toTypedSchema(formSchema),
});

const router = useRouter();
const auth = useAuthStore();
const errorMessage = ref<string | null>(null);

const onSubmit = form.handleSubmit(async ({ email, password }) => {
  errorMessage.value = null;
  try {
    const res = await fetch('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      errorMessage.value =
        res.status === 403
          ? 'Invalid email or password.'
          : 'Something went wrong. Please try again.';
      return;
    }
    auth.login();
    router.push('/');
  } catch {
    errorMessage.value = 'Could not reach the server.';
  }
});
</script>

<template>
  <Card class="w-full min-h-3/4 max-w-sm md:max-w-lg lg:max-w-2xl my-4 md:my-12 justify-evenly">
    <CardHeader class="text-center">
      <CardTitle class="text-3xl">Welcome Back</CardTitle>
      <CardDescription> Your next obsession is just a swipe away.</CardDescription>
    </CardHeader>

    <CardContent class="">
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
    </CardContent>

    <CardFooter class="flex flex-col gap-2">
      <div class="flex items-center space-x-2 text-nowrap">
        <p class="text-muted-foreground">Don't habe an account?</p>
        <RouterLink to="/signup" class="text-primary hover:underline">Sign Up</RouterLink>
      </div>
    </CardFooter>
  </Card>
</template>
