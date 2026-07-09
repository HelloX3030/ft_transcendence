import { friendsApi } from '@/api/endpoints/friends';
import { userApi } from '@/api/endpoints/user';
import type { Friend, GetUserResponse, UserSearchResponse } from '@trailertinder/shared';
import { defineStore } from 'pinia';
import { onMounted, ref } from 'vue';

export const useFriendsStore = defineStore('friends', () => {
  const friends = ref<Friend[]>([]);

  onMounted(async () => {
    friends.value = await friendsApi.getAll();
  });
  return { friends };
});
