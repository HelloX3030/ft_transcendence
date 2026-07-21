<script lang="ts" setup>
import { Camera } from '@lucide/vue';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useUserEdit } from '@/composables/useUserEdit';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { userEditSchema } from '@/lib/schemas';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';

const {
  fileInput,
  avatarSrc,
  initials,
  onFileChange,
  languageOptions,
  update,
  updateError,
  isLoading,
} = useUserEdit();
const userStore = useUserStore();
const { state: profile } = storeToRefs(userStore);

const form = useForm({
  validationSchema: toTypedSchema(userEditSchema),
  initialValues: {
    username: profile.value?.username ?? '',
    email: profile.value?.email ?? '',
    language: profile.value?.language ?? 'en',
  },
});

const onSubmit = form.handleSubmit(({ username, email, language }) => {
  update({ username, email, language });
});
</script>

<template>
  <div
    class="mx-auto w-full max-w-2xl md:max-w-none md:w-5/6 flex flex-col gap-6 p-4 sm:p-6 md:p-8"
  >
    <form @submit.prevent="onSubmit" class="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle class="text-lg font-semibold">Edit Profile</CardTitle>
        </CardHeader>

        <CardContent class="flex flex-col gap-6">
          <!-- Avatar upload -->
          <div class="flex items-center gap-4">
            <button
              type="button"
              class="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              @click="fileInput?.click()"
            >
              <Avatar class="size-20">
                <AvatarImage v-if="avatarSrc" :src="avatarSrc" alt="Avatar preview" />
                <AvatarFallback class="text-xl font-semibold">{{ initials }}</AvatarFallback>
              </Avatar>
              <div
                class="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-black/50 opacity-0 transition-opacity hover:opacity-100"
              >
                <Camera class="size-5 text-white" />
                <span class="text-[10px] font-medium text-white leading-none">Change</span>
              </div>
            </button>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onFileChange"
            />
            <p class="text-muted-foreground text-sm">Click the avatar to upload a new photo.</p>
          </div>

          <!-- Username -->

          <FormField v-slot="{ componentField }" name="username">
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input v-bind="componentField" type="text" placeholder="New Username..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="email">
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input v-bind="componentField" type="text" placeholder="New Email..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <!-- Language -->
          <div class="flex flex-col gap-2">
            <Label>Language</Label>
            <div class="flex gap-2">
              <Button
                v-for="opt in languageOptions"
                :key="opt.value"
                type="button"
                class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors"
                :class="
                  form.values.language === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                "
                @click="form.setFieldValue('language', opt.value)"
              >
                {{ opt.label }}
              </Button>
            </div>
          </div>

          <!-- General error -->
          <p v-if="updateError" class="text-destructive text-sm">{{ updateError }}</p>
        </CardContent>

        <CardFooter class="justify-between">
          <RouterLink to="/profile">
            <Button variant="outline">Cancel</Button>
          </RouterLink>
          <Button :disabled="isLoading" type="submit">
            {{ isLoading ? 'Saving…' : 'Save' }}
          </Button>
        </CardFooter>
      </Card>
    </form>
  </div>
</template>
