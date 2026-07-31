<script lang="ts" setup>
import FriendRequestList from '@/components/friends/FriendRequestList.vue';
import UserSearch from '@/components/friends/UserSearch.vue';
import { useFriendsStore } from '@/stores/friends';
import { storeToRefs } from 'pinia';

import { UserPlus } from '@lucide/vue';
import { ItemGroup } from '@/components/ui/item';
import FriendItem from '@/components/friends/FriendItem.vue';
import { onMounted } from 'vue';

const store = useFriendsStore();
const { state: friends, acceptedFriends, friendsDetails } = storeToRefs(store);

onMounted(() => store.ensureLoaded());
</script>

<template>
  <div class="py-6 min-w-5/6 mx-auto flex-1 space-y-6">
    <h1 class="text-3xl font-bold">Friends</h1>
    <UserSearch />

    <div v-if="friends.length > 0" class="space-y-4">
      <FriendRequestList />
      <h3 class="text-sm font-medium mb-2 text-muted-foreground">
        Friends ({{ acceptedFriends.length }})
      </h3>
      <ItemGroup class="gap-2" v-if="acceptedFriends.length > 0">
        <FriendItem
          v-for="friend in friendsDetails"
          :key="friend.id"
          v-bind="friend"
          :createdAt="friends.find((f) => f.friendId === friend.id)?.createdAt"
        />
      </ItemGroup>
    </div>
    <div
      v-else
      class="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl border border-zinc-800 bg-zinc-900/40"
    >
      <div
        class="w-12 h-12 rounded-full border border-dashed border-zinc-700 flex items-center justify-center mb-4"
      >
        <UserPlus class="text-primary" />
      </div>
      <p class="text-zinc-200 font-medium mb-1">No friends yet</p>
      <p class="text-zinc-500 text-sm max-w-xs">
        Search for a username above to connect and see what they're watching.
      </p>
    </div>
  </div>
</template>
