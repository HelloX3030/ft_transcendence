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

import Separator from '@/components/ui/separator/Separator.vue';
import { useAuthStore } from '@/stores/auth';

const form = useForm({
  validationSchema: toTypedSchema(registerSchema),
});

const router = useRouter();
const auth = useAuthStore();
const errorMessage = ref<string | null>(null);

const onSubmit = form.handleSubmit(async ({ username, email, password }) => {
  errorMessage.value = null;
  try {
    await auth.register({ username, email, password, language: 'de' }); //TODO: dynamic language
    router.push('/onboarding');
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e?.status === 403) {
      errorMessage.value = 'Email or username is already taken.';
    } else if (e?.status) {
      errorMessage.value = e.message ?? 'Something went wrong. Please try again.';
    } else {
      errorMessage.value = 'Could not reach the server.';
    }
  }
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
