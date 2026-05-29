<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Camera } from 'lucide-vue-next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

const username = ref(auth.user?.username ?? '');
const email = ref(auth.user?.email ?? '');
const language = ref<'de' | 'en' | 'es'>(auth.user?.language ?? 'en');

const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const avatarSrc = computed(() => previewUrl.value ?? auth.user?.image ?? null);
const initials = computed(() => (auth.user ? auth.user.username.slice(0, 2).toUpperCase() : '??'));

const saving = ref(false);
const usernameError = ref('');
const emailError = ref('');
const generalError = ref('');

const languageOptions: { value: 'de' | 'en' | 'es'; label: string }[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
}

async function save() {
  usernameError.value = '';
  emailError.value = '';
  generalError.value = '';
  saving.value = true;

  try {
    if (selectedFile.value) {
      const formData = new FormData();
      formData.append('file', selectedFile.value);
      const res = await fetch('/v1/users/me/avatar', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });
      if (!res.ok) throw new Error('Avatar upload failed');
      await auth.fetchUser();
    }

    const original = {
      username: auth.user?.username,
      email: auth.user?.email,
      language: auth.user?.language,
    };
    const payload: { username?: string; email?: string; language?: 'de' | 'en' | 'es' } = {};
    if (username.value !== original.username) payload.username = username.value;
    if (email.value !== original.email) payload.email = email.value;
    if (language.value !== original.language) payload.language = language.value;

    if (Object.keys(payload).length > 0) {
      await auth.updateUser(payload);
    }

    await router.push('/profile');
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e?.status === 403) {
      if (e?.message?.toLowerCase().includes('email')) {
        emailError.value = 'Email already taken';
      } else {
        usernameError.value = 'Username already taken';
      }
    } else {
      generalError.value = 'Something went wrong. Please try again.';
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl flex flex-col gap-6 p-4 sm:p-6">
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
        <div class="flex flex-col gap-1.5">
          <Label for="username">Username</Label>
          <Input id="username" v-model="username" autocomplete="username" />
          <p v-if="usernameError" class="text-destructive text-sm">{{ usernameError }}</p>
        </div>

        <!-- Email -->
        <div class="flex flex-col gap-1.5">
          <Label for="email">Email</Label>
          <Input id="email" v-model="email" type="email" autocomplete="email" />
          <p v-if="emailError" class="text-destructive text-sm">{{ emailError }}</p>
        </div>

        <!-- Language -->
        <div class="flex flex-col gap-1.5">
          <Label>Language</Label>
          <div class="flex gap-2">
            <button
              v-for="opt in languageOptions"
              :key="opt.value"
              type="button"
              class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors"
              :class="
                language === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              "
              @click="language = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- General error -->
        <p v-if="generalError" class="text-destructive text-sm">{{ generalError }}</p>
      </CardContent>

      <CardFooter class="justify-between">
        <RouterLink to="/profile">
          <Button variant="ghost">Cancel</Button>
        </RouterLink>
        <Button :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </Button>
      </CardFooter>
    </Card>
  </div>
</template>
