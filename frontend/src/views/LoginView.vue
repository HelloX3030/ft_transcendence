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

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { RouterLink } from 'vue-router';

// password: z
//   .string()
//   .min(8, { message: 'Password should have minimum length of 8' })
//   .max(15, 'Password is too long')
//   .regex(/^(?=.*[A-Z]).{8,}$/, {
//     message:
//       'Should Contain at least one uppercase letter and have a minimum length of 8 characters.',
//   }),

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().nonempty(),
});

const form = useForm({
  validationSchema: toTypedSchema(formSchema),
});

const onSubmit = form.handleSubmit((values) => {
  console.log('Form submitted!', values);
});
</script>

<template>
  <Card class="w-full max-w-xs mx-auto mt-12 h-3/4 justify-evenly bg-amber-600">
    <CardHeader class="text-center bg-amber-200">
      <CardTitle class="text-3xl">Welcome Back</CardTitle>
      <CardDescription> Your next obsession is just a swipe away.</CardDescription>
    </CardHeader>
    <form @submit.prevent="onSubmit" class="bg-amber-500 p-5 space-y-8">
      <CardContent class="bg-blue-600 space-y-8">
        <FormField v-slot="{ componentField }" name="email">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="password">
          <FormItem>
            <div class="flex items-center">
              <FormLabel>Password</FormLabel>
              <!-- TODO: forgot password logic -->
              <Button type="button" variant="link" class="ml-auto">Forgot your password?</Button>
            </div>
            <FormControl>
              <Input v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>
      <CardFooter class="flex flex-col gap-2 bg-blue-800">
        <Button type="submit" class="w-full"> Login </Button>
        <div class="w-full max-w-sm flex items-center gap-2">
          <Separator class="flex-1" />
          <span class="shrink-0 px-2 text-xs text-muted-foreground uppercase"> OR </span>
          <Separator class="flex-1" />
        </div>
        <!-- TODO: oauth implementation -->
        <Button type="button" variant="outline" class="w-full"
          ><img src="/google_icon.svg" class="size-6" /> Continue with Google
        </Button>
        <div class="flex items-center space-x-2">
          <p>Don't habe an account?</p>
          <RouterLink to="/signup" class="text-primary hover:underline">Sign Up</RouterLink>
        </div>
      </CardFooter>
    </form>
  </Card>
</template>
