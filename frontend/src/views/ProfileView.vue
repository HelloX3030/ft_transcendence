<script lang="ts" setup>
import { RouterLink } from 'vue-router';
import UserAvatar from '@/components/UserAvatar.vue';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import ProfilePreferences from '@/components/profile/ProfilePreferences.vue';
import TotpCard from '@/components/profile/TotpCard.vue';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';

const userStore = useUserStore();

const { state: profile } = storeToRefs(userStore);

const languageLabel: Record<string, string> = { de: 'Deutsch', en: 'English', es: 'Español' };
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

      <ProfilePreferences
        :genre-ids="profile.genreIds"
        :actor-ids="profile.actorIds"
        :director-ids="profile.directorIds"
      />
      <TotpCard :totp-active="profile.totpActive" />
    </template>
  </div>
</template>
