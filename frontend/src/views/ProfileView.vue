<script lang="ts" setup>
import { computed, onMounted } from 'vue';
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
import { useGenresStore } from '@/stores/genres';

const auth = useAuthStore();
const genres = useGenresStore();
const profile = computed(() => auth.user);

const initials = computed(() =>
  profile.value ? profile.value.username.slice(0, 2).toUpperCase() : '??',
);

const languageLabel: Record<string, string> = { de: 'Deutsch', en: 'English', es: 'Español' };

// Resolve the user's favorite genre ids to names, dropping any the catalogue
// doesn't know about (it may still be loading or the id may be stale).
const favoriteGenres = computed(() =>
  (profile.value?.genreIds ?? [])
    .map((id) => genres.genreName(id))
    .filter((name): name is string => name !== undefined),
);

onMounted(() => {
  void genres.ensureLoaded();
});
</script>

<template>
  <div
    class="mx-auto w-full max-w-2xl md:max-w-none md:w-5/6 flex flex-col gap-6 p-4 sm:p-6 md:p-8"
  >
    <template v-if="profile">
      <Card>
        <CardHeader>
          <div class="flex min-w-0 items-center gap-4">
            <Avatar class="size-20 shrink-0">
              <AvatarImage v-if="profile.image" :src="profile.image" :alt="profile.username" />
              <AvatarFallback class="text-xl font-semibold">{{ initials }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex flex-col gap-1">
              <CardTitle class="break-words text-2xl">{{ profile.username }}</CardTitle>
              <CardDescription>{{ profile.email }}</CardDescription>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 mt-3">
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

      <Card>
        <CardHeader>
          <CardTitle class="text-muted-foreground text-sm font-medium">Favorite Genres</CardTitle>
        </CardHeader>
        <CardContent>
          <div v-if="favoriteGenres.length" class="flex flex-wrap gap-2">
            <span
              v-for="genre in favoriteGenres"
              :key="genre"
              class="text-primary rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium"
            >
              {{ genre }}
            </span>
          </div>
          <p v-else class="text-muted-foreground text-sm">No favorite genres yet</p>
        </CardContent>
      </Card>

      <Card v-for="label in ['Favorite Directors', 'Favorite Actors']" :key="label">
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
