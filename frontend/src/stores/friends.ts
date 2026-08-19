import { friendsApi } from '@/api/endpoints/friends';
import { useUserDetails } from '@/composables/useUserDetails';
import { logger } from '@/lib/logger';
import type { Friend } from '@cinemates/shared';

import { useAsyncState } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed } from 'vue';

export const useFriendsStore = defineStore('friends', () => {
  let generation = 0;

  const {
    state,
    isLoading,
    isReady,
    error,
    execute: executeRefetchFriends,
  } = useAsyncState<Friend[]>(
    async () => {
      const requestGeneration = generation;
      try {
        const friends = await friendsApi.getAll();
        return requestGeneration === generation ? friends : [];
      } catch (error) {
        if (requestGeneration !== generation) return [];
        throw error;
      }
    },
    [],
    {
      // Nothing is signed in when this store is built. It is created transitively
      // by useAuthStore() in main.ts, three lines before auth.init() runs, so a
      // fetch here is an authenticated request made before anyone could know
      // whether there is a session — a guaranteed 401 for every logged-out
      // visitor. ensureLoaded() is how the list is first populated instead.
      immediate: false,
      // Without this, vueuse falls through to globalThis.reportError, which
      // announces a failure the store has already captured in `error` as though
      // it were an uncaught exception.
      onError: (error) => logger.debug('[friends] failed to load', error),
    },
  );

  async function refetchFriends() {
    return executeRefetchFriends();
  }

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

  // Same call as declineRequest and deleteFriend, kept apart because the backend
  // branches on who is deleting what: the peer of a cancelled request is told
  // "cancelled", not "declined" or "removed".
  async function cancelRequest(friendId: number) {
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
    generation++;
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
    cancelRequest,
    sendRequest,
    deleteFriend,
    $reset,
    ensureLoaded,
  };
});
