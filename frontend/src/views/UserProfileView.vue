<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { UserProfileResponse } from '@cinemates/shared';
import { userApi } from '@/api/endpoints/user';
import { ApiError } from '@/api/api-error';
import UserAvatar from '@/components/UserAvatar.vue';
import ErrorState from '@/components/ErrorState.vue';
import PresenceDot from '@/components/PresenceDot.vue';
import ProfilePreferences from '@/components/profile/ProfilePreferences.vue';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton/Skeleton.vue';
import { UserRound, MessageCircle } from '@lucide/vue';
import { useChatStore } from '@/stores/chat';
import { useFriendsStore } from '@/stores/friends';
import { useNotifyStore } from '@/stores/notify';
import { useUserStore } from '@/stores/user';
import { formatDate } from '@/lib/format';
import { toast } from 'vue-sonner';

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();
const friendsStore = useFriendsStore();
const notify = useNotifyStore();
const userStore = useUserStore();

const profile = ref<UserProfileResponse | null>(null);
const loading = ref(true);
const notFound = ref(false);
const error = ref(false);
const isSending = ref(false);

const profileId = computed(() => Number(route.params.id));

// A profile can be opened straight from a URL, with no friends list fetched
// yet — and the action button below is read off that list.
void friendsStore.ensureLoaded();

async function load() {
  loading.value = true;
  notFound.value = false;
  error.value = false;
  profile.value = null;

  const id = profileId.value;
  // `/users/abc` is "no such user", not a failure: sending it would earn a 400
  // from the backend's ParseIntPipe, which would render as an error state.
  if (!Number.isInteger(id)) {
    notFound.value = true;
    loading.value = false;
    return;
  }

  try {
    profile.value = await userApi.getProfileById(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound.value = true;
    else error.value = true;
  } finally {
    loading.value = false;
  }
}

// Not onMounted: the router reuses this component between /users/7 and
// /users/9, which two members of a shared watchlist make one click apart.
watch(profileId, load, { immediate: true });

const isSelf = computed(() => profile.value?.id === userStore.state?.id);

const friendship = computed(() => friendsStore.state.find((f) => f.friendId === profileId.value));

/** What is true between the signed-in user and this profile. */
const relation = computed(() => {
  if (isSelf.value) return 'self';
  const row = friendship.value;
  if (!row) return 'none';
  if (row.status === 'accepted') return 'friends';
  return row.initiatorId === userStore.state?.id ? 'sent' : 'received';
});

/**
 * Presence is seeded per friend, so `isUserOnline` reads false for everyone
 * else — a dot on a stranger would assert something we do not know.
 */
const isOnline = computed(() => notify.isUserOnline(profileId.value));

// Same phrasing as the friends list row, off the same `createdAt`.
const friendsSince = computed(() => {
  const createdAt = friendship.value?.createdAt;
  if (relation.value !== 'friends' || createdAt === undefined) return null;
  return formatDate(createdAt);
});

async function handleMessage() {
  if (!profile.value) return;
  chatStore.createChat(profile.value);
  await router.push('/chat');
}

async function handleAddFriend() {
  isSending.value = true;
  try {
    await friendsStore.sendRequest(profileId.value);
    toast.success('Friend request sent');
  } catch (err) {
    toast.error((err as Error).message);
  } finally {
    isSending.value = false;
  }
}
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
    <ErrorState v-else-if="error" message="Could not load this profile." @retry="load" />

    <!-- Profile -->
    <template v-else-if="profile">
      <div class="flex flex-wrap items-center gap-5">
        <span class="relative inline-flex">
          <UserAvatar
            :avatar-file-id="profile.avatarFileId"
            :username="profile.username"
            class="size-24 text-2xl font-semibold"
          />
          <PresenceDot v-if="relation === 'friends'" overlay :online="isOnline" />
        </span>

        <div class="flex flex-1 flex-col gap-3">
          <div class="flex flex-col gap-1">
            <h1 class="text-2xl font-bold">{{ profile.username }}</h1>
            <p v-if="friendsSince" class="text-muted-foreground text-sm">
              Friends since {{ friendsSince }}
            </p>
          </div>
          <div class="flex gap-2">
            <!--
              Message is offered to friends only: the chat store is seeded one
              entry per friend and presence exists for friends alone, so a
              transcript with a stranger is one nothing else in the app knows.
            -->
            <Button v-if="relation === 'friends'" variant="outline" @click="handleMessage">
              <MessageCircle class="size-4" />
              Message
            </Button>
            <Button
              v-else-if="relation === 'none'"
              variant="outline"
              :disabled="isSending"
              @click="handleAddFriend"
            >
              <UserRound class="size-4" />
              Add Friend
            </Button>
            <!-- Taking it back belongs on the friends page, beside the row. -->
            <Button v-else-if="relation === 'sent'" variant="outline" disabled>
              <UserRound class="size-4" />
              Request sent
            </Button>
            <Button v-else-if="relation === 'received'" variant="outline" as-child>
              <RouterLink to="/friends">Respond on the Friends page</RouterLink>
            </Button>
          </div>
        </div>
      </div>

      <ProfilePreferences
        :genre-ids="profile.genreIds"
        :actor-ids="profile.actorIds"
        :director-ids="profile.directorIds"
      />
    </template>
  </div>
</template>
