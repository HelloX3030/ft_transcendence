import { userApi } from '@/api/endpoints/user';
import type { UserSearchResponse } from '@cinemates/shared';
import { ref } from 'vue';
import { logger } from '@/lib/logger';

export function useUserSearch() {
  const searchStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const searchData = ref<UserSearchResponse | null>(null);
  async function search(params: { query: string; page?: number; limit?: number }) {
    try {
      searchStatus.value = 'loading';
      const data = await userApi.search(params);
      searchData.value = data;
      searchStatus.value = 'ready';
    } catch (error) {
      logger.error(error);
      searchStatus.value = 'error';
    }
  }

  function resetSearch() {
    searchStatus.value = 'idle';
    searchData.value = null;
  }
  return { searchData, searchStatus, search, resetSearch };
}
