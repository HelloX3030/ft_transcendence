<script lang="ts" setup>
import Friend from '@/components/friends/Friend.vue';
import UserOverview from '@/components/friends/UserOverview.vue';
import UserSearch from '@/components/friends/UserSearch.vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFriendsStore } from '@/stores/friends';
import { Users } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';

const store = useFriendsStore();

const { friends } = storeToRefs(store);
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 p-6">
    <h1 class="text-2xl font-bold">Friends</h1>
    <UserSearch />
    <!-- <UserOverview :username="'philipp'" :id="1" /> -->

    <Friend v-for="friend in friends" :key="friend.friendId" v-bind="friend" />
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
