<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import UserAvatar from '@/components/UserAvatar.vue';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useGenresStore } from '@/stores/genres';
import { usePeopleStore } from '@/stores/people';
import TotpCard from '@/components/profile/TotpCard.vue';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';

const userStore = useUserStore();

const { state: profile } = storeToRefs(userStore);
const genres = useGenresStore();
const people = usePeopleStore();

const languageLabel: Record<string, string> = { de: 'Deutsch', en: 'English', es: 'Español' };

// Map preference id lists to display names, dropping any not yet resolved (the
// catalogue/people cache may still be loading, or an id may be stale).
function resolveNames(ids: number[] | undefined, lookup: (id: number) => string | undefined) {
  return (ids ?? []).map(lookup).filter((name): name is string => name !== undefined);
}

const preferenceSections = computed(() => [
  {
    label: 'Favorite Genres',
    items: resolveNames(profile.value?.genreIds, genres.genreName),
    empty: 'No favorite genres yet',
  },
  {
    label: 'Favorite Directors',
    items: resolveNames(profile.value?.directorIds, people.personName),
    empty: 'No favorite directors yet',
  },
  {
    label: 'Favorite Actors',
    items: resolveNames(profile.value?.actorIds, people.personName),
    empty: 'No favorite actors yet',
  },
]);

// The person ids to resolve, recomputed when the profile loads (it may arrive
// after this view mounts).
const personIds = computed(() => [
  ...(profile.value?.directorIds ?? []),
  ...(profile.value?.actorIds ?? []),
]);

onMounted(() => {
  void genres.ensureLoaded();
});

watch(
  personIds,
  (ids) => {
    if (ids.length) void people.ensureLoaded(ids);
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="mx-auto w-full max-w-2xl md:max-w-none md:w-5/6 flex flex-col gap-6 p-4 sm:p-6 md:p-8"
  >
    <template v-if="profile">
      <Card>
        <CardHeader>
          <div class="flex min-w-0 items-center gap-4">
            <UserAvatar
              :avatar-file-id="profile.avatarFileId"
              :username="profile.username"
              class="size-20 shrink-0 text-xl font-semibold"
            />
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

      <Card v-for="section in preferenceSections" :key="section.label">
        <CardHeader>
          <CardTitle class="text-muted-foreground text-sm font-medium">{{
            section.label
          }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div v-if="section.items.length" class="flex flex-wrap gap-2">
            <span
              v-for="item in section.items"
              :key="item"
              class="text-primary rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium"
            >
              {{ item }}
            </span>
          </div>
          <p v-else class="text-muted-foreground text-sm">{{ section.empty }}</p>
        </CardContent>
      </Card>
      <TotpCard :totp-active="profile.totpActive" />
    </template>
  </div>
</template>
