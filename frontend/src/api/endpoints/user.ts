import type {
  GetUserResponse,
  UpdateUserRequest,
  UserMeResponse,
  UserSearchResponse,
} from '@trailertinder/shared';
import { backendClient } from '../client';

export const userApi = {
  getMe: () => backendClient<UserMeResponse>('/users/me'),

  getById: (id: number) => backendClient<GetUserResponse>(`/users/${id}`),

  search: ({ query, page, limit }: { query: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams({ query });

    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));

    return backendClient<UserSearchResponse>(`/users/search?${params.toString()}`);
  },

  uploadAvatar: (payload: FormData) => {
    backendClient('/users/me/avatar', {
      method: 'POST',
      body: payload,
    });
  },

  update: (payload: UpdateUserRequest) =>
    backendClient('/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  onboarding: (movieIds: number[]) =>
    backendClient<string>('/users/me/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieIds }),
    }),

  setupTotp: () => backendClient<string>('/users/mfa/totp/setup', { method: 'POST' }),

  activateTotp: (otp: string) =>
    backendClient('/users/mfa/totp/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp }),
    }),

  deleteTotp: () => backendClient('/users/mfa/totp', { method: 'DELETE' }),
};
