<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Skeleton from '@/components/ui/skeleton/Skeleton.vue';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  image: string | null;
  language: 'de' | 'en' | 'es';
  role: 'admin' | 'user';
}

const profile = ref<UserProfile | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const res = await fetch('/v1/users/me', { credentials: 'same-origin' });
    if (!res.ok) throw new Error();
    profile.value = await res.json();
  } catch {
    error.value = 'Could not load profile.';
  } finally {
    loading.value = false;
  }
});

const initials = computed(() =>
  profile.value ? profile.value.username.slice(0, 2).toUpperCase() : '??',
);

const languageLabel: Record<string, string> = { de: 'Deutsch', en: 'English', es: 'Español' };
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-8 p-6">
    <!-- Loading skeleton -->
    <div v-if="loading" class="flex items-center gap-5">
      <Skeleton class="size-24 rounded-full" />
      <div class="flex flex-col gap-2">
        <Skeleton class="h-7 w-48" />
        <Skeleton class="h-4 w-64" />
        <Skeleton class="mt-1 h-5 w-20 rounded-full" />
      </div>
    </div>

    <!-- Error -->
    <p v-else-if="error" class="text-destructive">{{ error }}</p>

    <!-- Profile -->
    <template v-else-if="profile">
      <div class="flex flex-wrap items-center gap-5">
        <Avatar class="size-24">
          <AvatarImage v-if="profile.image" :src="profile.image" :alt="profile.username" />
          <AvatarFallback class="text-2xl font-semibold">{{ initials }}</AvatarFallback>
        </Avatar>

        <div class="flex flex-1 flex-col gap-1">
          <h1 class="text-2xl font-bold">{{ profile.username }}</h1>
          <p class="text-muted-foreground text-sm">{{ profile.email }}</p>
          <div class="mt-1 flex gap-2">
            <span class="text-primary rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
              {{ languageLabel[profile.language] }}
            </span>
            <span
              v-if="profile.role === 'admin'"
              class="text-primary rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium"
            >
              Admin
            </span>
          </div>
        </div>

        <Button variant="outline" disabled class="shrink-0">Edit Profile</Button>
      </div>

      <!-- Preference placeholders -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          v-for="label in ['Favorite Genres', 'Favorite Directors', 'Favorite Actors']"
          :key="label"
        >
          <CardHeader class="pb-2">
            <CardTitle class="text-muted-foreground text-sm font-medium">{{ label }}</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-muted-foreground text-sm">Coming soon</p>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>
