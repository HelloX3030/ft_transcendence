<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import FriendRequestItem from './FriendRequestItem.vue';
import { ItemGroup } from '../ui/item/index.ts';
import { useFriendsStore } from '@/stores/friends.ts';
import { storeToRefs } from 'pinia';

const { user: me } = useAuthStore();

const { state: friends } = storeToRefs(useFriendsStore());

const incomingRequests = computed(() =>
  friends.value.filter((f) => f.initiatorId !== me?.id && f.status !== 'accepted'),
);
const outgoingRequests = computed(() =>
  friends.value.filter((f) => f.initiatorId === me?.id && f.status !== 'accepted'),
);
</script>

<template>
  <div class="space-y-6">
    <section v-if="incomingRequests.length">
      <h3 class="text-sm font-medium mb-2 text-muted-foreground">
        Friend Requests ({{ incomingRequests.length }})
      </h3>
      <div class="space-y-2">
        <FriendRequestItem
          v-for="friend in incomingRequests"
          v-bind="friend"
          :key="friend.friendId"
        />
      </div>
    </section>

    <section v-if="outgoingRequests.length">
      <h3 class="text-sm font-medium mb-2 text-muted-foreground">
        Sent Requests ({{ outgoingRequests.length }})
      </h3>
      <ItemGroup class="gap-2">
        <FriendRequestItem
          v-for="friend in outgoingRequests"
          v-bind="friend"
          :key="friend.friendId"
        />
      </ItemGroup>
    </section>

    <p
      v-if="!incomingRequests.length && !outgoingRequests.length"
      class="text-sm text-muted-foreground"
    >
      No pending friend requests.
    </p>
  </div>
</template>
