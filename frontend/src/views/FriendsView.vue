<script lang="ts" setup>
import FriendRequestList from '@/components/friends/FriendRequestList.vue';
import Friend from '@/components/friends/Friend.vue';
import UserSearch from '@/components/friends/UserSearch.vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFriendsStore } from '@/stores/friends';
import { Users } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import FriendList from '@/components/friends/FriendList.vue';
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 p-6">
    <h1 class="text-2xl font-bold">Friends</h1>
    <UserSearch />

    <!-- <Friend v-for="friend in friends" :key="friend.friendId" v-bind="friend" /> -->
    <FriendRequestList />
    <FriendList />
    <Card>
      <CardHeader class="items-center text-center">
        <Users class="text-muted-foreground size-10" />
        <CardTitle class="text-muted-foreground text-base font-medium">Coming soon</CardTitle>
      </CardHeader>
      <CardContent class="text-center">
        <p class="text-muted-foreground text-sm">
          Friend requests, online status, and chat are on the roadmap.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
