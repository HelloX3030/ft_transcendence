<script lang="ts" setup>
import { Camera } from '@lucide/vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { useUserEdit } from '@/composables/useUserEdit';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { userEditSchema } from '@/lib/schemas';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { Progress } from '@/components/ui/progress';
import AvatarDeleteDialog from '@/components/profile/AvatarDeleteDialog.vue';

const {
  fileInput,
  avatarSrc,
  hasAvatar,
  onFileChange,
  fileError,
  update,
  updateError,
  isLoading,
  isUploading,
  uploadProgress,
  cancelUpload,
  removeAvatar,
} = useUserEdit();
const userStore = useUserStore();
const { state: profile } = storeToRefs(userStore);

const showRemoveDialog = ref(false);

async function confirmRemoveAvatar() {
  await removeAvatar();
  showRemoveDialog.value = false;
}

const form = useForm({
  validationSchema: toTypedSchema(userEditSchema),
  initialValues: {
    username: profile.value?.username ?? '',
    email: profile.value?.email ?? '',
  },
});

const onSubmit = form.handleSubmit(({ username, email }) => {
  update({ username, email });
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
              <UserAvatar
                :src="avatarSrc"
                :username="profile?.username"
                class="size-20 text-xl font-semibold"
              />
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
              accept="image/png,image/jpeg,image/webp"
              class="hidden"
              @change="onFileChange"
            />
            <div class="flex flex-col gap-1">
              <p class="text-muted-foreground text-sm">Click the avatar to upload a new photo.</p>
              <p class="text-muted-foreground text-xs">PNG, JPEG or WebP, up to 5 MB.</p>
              <Button
                v-if="hasAvatar"
                type="button"
                variant="link"
                class="text-destructive h-auto w-fit p-0 text-sm"
                :disabled="isLoading"
                @click="showRemoveDialog = true"
              >
                Remove photo
              </Button>
            </div>
          </div>

          <!-- Rejected client-side, before any bytes are sent -->
          <p v-if="fileError" class="text-destructive text-sm">{{ fileError }}</p>

          <!-- Real byte progress, with a working cancel -->
          <div v-if="isUploading" class="flex items-center gap-3">
            <Progress :model-value="uploadProgress ?? 0" class="flex-1" />
            <span class="text-muted-foreground w-10 text-right text-xs tabular-nums">
              {{ Math.round(uploadProgress ?? 0) }}%
            </span>
            <Button type="button" variant="outline" size="sm" @click="cancelUpload">Cancel</Button>
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

    <AvatarDeleteDialog
      v-model:open="showRemoveDialog"
      :is-deleting="isLoading"
      @confirm="confirmRemoveAvatar"
    />
  </div>
</template>
