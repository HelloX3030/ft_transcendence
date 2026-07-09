import type { GetUserResponse, UserSearchResponse } from '@trailertinder/shared';
import { backendClient } from '../client';

export const userApi = {
  getById: (id: number) => backendClient<GetUserResponse>(`/users/${id}`),

  search: ({ query, page, limit }: { query: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams({ query });

    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));

    return backendClient<UserSearchResponse>(`/users/search?${params.toString()}`);
  },
};
