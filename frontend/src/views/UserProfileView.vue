<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton/Skeleton.vue';
import { UserRound, MessageCircle } from 'lucide-vue-next';

interface PublicProfile {
  id: number;
  username: string;
  image: string | null;
}

const route = useRoute();
const profile = ref<PublicProfile | null>(null);
const loading = ref(true);
const notFound = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  const id = route.params.id;
  try {
    const res = await fetch(`/v1/users/${id}`, { credentials: 'same-origin' });
    if (res.status === 404) {
      notFound.value = true;
      return;
    }
    if (!res.ok) throw new Error();
    profile.value = await res.json();
  } catch {
    error.value = 'Could not load this profile.';
  } finally {
    loading.value = false;
  }
});

const initials = computed(() =>
  profile.value ? profile.value.username.slice(0, 2).toUpperCase() : '??',
);
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-8 p-6">
    <!-- Loading skeleton -->
    <div v-if="loading" class="flex items-center gap-5">
      <Skeleton class="size-24 rounded-full" />
      <div class="flex flex-col gap-2">
        <Skeleton class="h-7 w-48" />
        <Skeleton class="mt-2 h-9 w-28 rounded-md" />
      </div>
    </div>

    <!-- Not found -->
    <div v-else-if="notFound" class="flex flex-col items-center gap-3 py-16 text-center">
      <UserRound class="text-muted-foreground size-12" />
      <h2 class="text-lg font-semibold">User not found</h2>
      <p class="text-muted-foreground text-sm">This profile doesn't exist.</p>
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

        <div class="flex flex-1 flex-col gap-3">
          <h1 class="text-2xl font-bold">{{ profile.username }}</h1>
          <div class="flex gap-2">
            <Button variant="outline" disabled>
              <UserRound class="size-4" />
              Add Friend
            </Button>
            <Button variant="ghost" disabled>
              <MessageCircle class="size-4" />
              Message
            </Button>
          </div>
        </div>
      </div>
      <test>TEST</test>
    </template>
  </div>
</template>
