import type { NotificationPage, UnreadCount } from '@cinemates/shared';
import { backendClient } from '../client';

export const notificationsApi = {
  list: ({
    cursor,
    limit,
    unreadOnly,
  }: {
    cursor?: string;
    limit?: number;
    unreadOnly?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (cursor !== undefined) params.set('cursor', cursor);
    if (limit !== undefined) params.set('limit', String(limit));
    if (unreadOnly) params.set('unreadOnly', 'true');

    const query = params.toString();
    return backendClient<NotificationPage>(`/notifications${query === '' ? '' : `?${query}`}`);
  },

  unreadCount: () => backendClient<UnreadCount>('/notifications/unread-count'),

  markRead: (id: number) =>
    backendClient<UnreadCount>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () => backendClient<UnreadCount>('/notifications/read-all', { method: 'POST' }),

  remove: (id: number) => backendClient<UnreadCount>(`/notifications/${id}`, { method: 'DELETE' }),

  clear: () => backendClient<UnreadCount>('/notifications', { method: 'DELETE' }),
};
