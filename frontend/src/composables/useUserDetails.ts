import { useAsyncState } from '@vueuse/core';
import { userApi } from '@/api/endpoints/user';

export function useUserDetails(userIds: number[]) {
  const {
    state: userDetails,
    isLoading: usersLoading,
    error: usersError,
    execute: refetchUsers,
  } = useAsyncState(() => Promise.all(userIds.map((id) => userApi.getById(id))), []);

  return { userDetails, usersLoading, usersError, refetchUsers };
}
