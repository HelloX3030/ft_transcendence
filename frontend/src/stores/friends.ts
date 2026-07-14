import { friendsApi } from '@/api/endpoints/friends';

import { useAsyncState } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed } from 'vue';

export const useFriendsStore = defineStore('friends', () => {
  const {
    state,
    isLoading,
    isReady,
    error,
    execute: refetchFriends,
  } = useAsyncState(() => friendsApi.getAll(), []);

  const acceptedFriends = computed(() => state.value.filter((f) => f.status === 'accepted'));

  async function acceptRequest(friendId: number) {
    await friendsApi.acceptRequest(friendId);
    await refetchFriends();
  }

  async function declineRequest(friendId: number) {
    await friendsApi.delete(friendId);
    await refetchFriends();
  }

  async function sendRequest(userId: number) {
    await friendsApi.sendRequest(userId);
    await refetchFriends();
  }

  async function deleteFriend(friendId: number) {
    await friendsApi.delete(friendId);
    await refetchFriends();
  }

  return {
    state,
    acceptedFriends,
    isLoading,
    isReady,
    error,
    refetchFriends,
    acceptRequest,
    declineRequest,
    sendRequest,
    deleteFriend,
  };
});
