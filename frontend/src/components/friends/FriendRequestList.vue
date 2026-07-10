<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import FriendRequestItem from './FriendRequestItem.vue';
import { useFriendsStore } from '@/stores/friends.ts';
import { storeToRefs } from 'pinia';

const { user: me } = useAuthStore();

const friendsStore = useFriendsStore();
const { friends } = storeToRefs(friendsStore);

const incomingRequests = computed(() =>
  friends.value.filter((f) => f.status === 'pending' && f.initiatorId !== me?.id),
);

const outgoingRequests = computed(() =>
  friends.value.filter((f) => f.status === 'pending' && f.initiatorId === me?.id),
);

function handleResolved(friendId: number) {
  friends.value = friends.value.filter((f) => f.friendId !== friendId);
}
</script>

<template>
  <div class="space-y-6">
    <section v-if="incomingRequests.length">
      <h3 class="text-sm font-medium mb-2">Friend Requests ({{ incomingRequests.length }})</h3>
      <div class="space-y-2">
        <FriendRequestItem
          v-for="friend in incomingRequests"
          v-bind="friend"
          :key="friend.friendId"
          @accepted="handleResolved"
          @declined="handleResolved"
        />
      </div>
    </section>

    <section v-if="outgoingRequests.length">
      <h3 class="text-sm font-medium mb-2 text-muted-foreground">
        Sent Requests ({{ outgoingRequests.length }})
      </h3>
      <div class="space-y-2">
        <FriendRequestItem
          v-for="friend in outgoingRequests"
          v-bind="friend"
          :key="friend.friendId"
        />
      </div>
    </section>

    <p
      v-if="!incomingRequests.length && !outgoingRequests.length"
      class="text-sm text-muted-foreground"
    >
      No pending friend requests.
    </p>
  </div>
</template>
