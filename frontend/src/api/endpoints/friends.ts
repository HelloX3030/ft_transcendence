import type { Friend } from '@trailertinder/shared';
import { backendClient } from '../client';

export const friendsApi = {
  getAll: () => backendClient<Friend[]>('/friends'),

  sendRequest: (id: number) => backendClient(`/friends/${id}`, { method: 'POST' }),

  acceptRequest: (id: number) => backendClient(`/friends/${id}/accept`, { method: 'PATCH' }),

  delete: (id: number) => backendClient(`/friends/${id}`, { method: 'DELETE' }),
};
