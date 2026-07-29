import { friendsApi } from '@/api/endpoints/friends';
import { useUserDetails } from '@/composables/useUserDetails';

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

  const acceptedFriends = computed(() =>
    isReady.value ? state.value.filter((f) => f.status === 'accepted') : [],
  );
  const acceptedFriendsId = computed(() => acceptedFriends.value.map((f) => f.friendId));

  const { state: friendsDetails } = useUserDetails(acceptedFriendsId);

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

  function $reset() {
    state.value = [];
    isReady.value = false;
    error.value = null;
    friendsDetails.value = [];
  }

  async function ensureLoaded() {
    if (isReady.value || isLoading.value) return;
    await refetchFriends();
  }

  return {
    state,
    friendsDetails,
    acceptedFriends,
    isLoading,
    isReady,
    error,
    refetchFriends,
    acceptRequest,
    declineRequest,
    sendRequest,
    deleteFriend,
    $reset,
    ensureLoaded,
  };
});
