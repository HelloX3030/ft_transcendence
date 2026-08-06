import type {
  GetUserResponse,
  UpdateUserRequest,
  UserMeResponse,
  UserSearchResponse,
} from '@cinemates/shared';
import { backendClient } from '../client';
import { uploadWithProgress, type UploadOptions } from '../upload';

export const userApi = {
  getMe: () => backendClient<UserMeResponse>('/users/me'),

  getById: (id: number) => backendClient<GetUserResponse>(`/users/${id}`),

  search: ({ query, page, limit }: { query: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams({ query });

    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));

    return backendClient<UserSearchResponse>(`/users/search?${params.toString()}`);
  },

  uploadAvatar: (payload: FormData, opts?: UploadOptions) =>
    uploadWithProgress<UserMeResponse>('/users/me/avatar', payload, opts),

  deleteAvatar: () => backendClient<UserMeResponse>('/users/me/avatar', { method: 'DELETE' }),

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

  deleteTotp: (otp: string) =>
    backendClient('/users/mfa/totp', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp }),
    }),
};
