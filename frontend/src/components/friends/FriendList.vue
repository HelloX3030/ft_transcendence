<script setup lang="ts">
import { useFriendsStore } from '@/stores/friends.ts';
import Friend from './Friend.vue';
import { storeToRefs } from 'pinia';

const store = useFriendsStore();
const { friends } = storeToRefs(store);
</script>

<template>
  <section>
    <h1>Friends:</h1>
    <div>
      <Friend v-for="friend in friends" :key="friend.friendId" v-bind="friend" />
    </div>
  </section>
</template>
