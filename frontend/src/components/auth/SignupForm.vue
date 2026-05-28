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

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { RouterLink } from 'vue-router';
import { registerSchema } from '@/lib/schemas';
import { Eye, EyeOff } from 'lucide-vue-next';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { z } from 'zod';
import Separator from '@/components/ui/separator/Separator.vue';
import { useAuthStore } from '@/stores/auth';

const form = useForm({
  validationSchema: toTypedSchema(registerSchema),
});

const router = useRouter();
const auth = useAuthStore();
const errorMessage = ref<string | null>(null);

type RegisterValueType = z.infer<typeof registerSchema>;

async function createAccount({
  username,
  email,
  password,
}: RegisterValueType): Promise<true | string> {
  try {
    const res = await fetch('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, language: 'de' }), //TODO: dynamic language
    });
    if (!res.ok) {
      return res.status === 403
        ? 'Email or username is already taken.'
        : 'Something went wrong. Please try again.';
    }
    return true;
  } catch {
    return 'Could not reach the server.';
  }
}

const onSubmit = form.handleSubmit(async (values) => {
  errorMessage.value = null;
  const result = await createAccount(values);
  if (result !== true) {
    errorMessage.value = result;
    return;
  }
  auth.register();
  router.push('/onboarding');
});

const isPwVisible = ref(false);
</script>

<template>
  <Card class="w-full min-h-3/4 max-w-sm md:max-w-lg lg:max-w-2xl my-4 md:my-12 justify-evenly">
    <CardHeader class="text-center">
      <CardTitle class="text-3xl">Create your Account</CardTitle>
      <CardDescription>Join the hunt for your next favorite movie.</CardDescription>
    </CardHeader>

    <CardContent class="">
      <form @submit.prevent="onSubmit" class="space-y-6">
        <FormField v-slot="{ componentField }" name="username">
          <FormItem>
            <FormLabel>Username</FormLabel>
            <FormControl>
              <Input v-bind="componentField" placeholder="urbi420" type="text" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="email" type="email">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input v-bind="componentField" placeholder="email@cinemates.de" />
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
                  placeholder="🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄"
                  :type="isPwVisible ? 'text' : 'password'"
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
              <Input v-bind="componentField" placeholder="🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄🞄" type="password" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <div class="mt-8 flex flex-col space-y-4">
          <p v-if="errorMessage" class="text-sm text-destructive text-center">{{ errorMessage }}</p>
          <Button type="submit" class="w-full">Create Account</Button>
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

    <CardFooter class="flex justify-center gap-2">
      <p class="text-muted-foreground">Already have an account?</p>
      <RouterLink to="/login" class="text-primary hover:underline">Login</RouterLink>
    </CardFooter>
  </Card>
</template>
