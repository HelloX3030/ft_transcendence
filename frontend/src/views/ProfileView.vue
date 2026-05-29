<script lang="ts" setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const profile = computed(() => auth.user);

const initials = computed(() =>
  profile.value ? profile.value.username.slice(0, 2).toUpperCase() : '??',
);

const languageLabel: Record<string, string> = { de: 'Deutsch', en: 'English', es: 'Español' };
</script>

<template>
  <div class="mx-auto w-full max-w-2xl flex flex-col gap-6 p-4 sm:p-6">
    <template v-if="profile">
      <Card>
        <CardHeader>
          <div class="flex min-w-0 items-center gap-4">
            <Avatar class="size-20 shrink-0">
              <AvatarImage v-if="profile.image" :src="profile.image" :alt="profile.username" />
              <AvatarFallback class="text-xl font-semibold">{{ initials }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0">
              <CardTitle class="break-words text-2xl">{{ profile.username }}</CardTitle>
              <CardDescription>{{ profile.email }}</CardDescription>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
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
        </CardHeader>
        <CardFooter class="justify-end">
          <RouterLink to="/profile/edit">
            <Button variant="outline">Edit Profile</Button>
          </RouterLink>
        </CardFooter>
      </Card>

      <Card
        v-for="label in ['Favorite Genres', 'Favorite Directors', 'Favorite Actors']"
        :key="label"
      >
        <CardHeader>
          <CardTitle class="text-muted-foreground text-sm font-medium">{{ label }}</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-muted-foreground text-sm">Coming soon</p>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
