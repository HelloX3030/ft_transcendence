import type { ChatConversation, ChatMessagePage, ChatReadResponse } from '@cinemates/shared';
import { backendClient } from '../client';

export const chatApi = {
  conversations: () => backendClient<ChatConversation[]>('/chat/conversations'),

  messages: (peerId: number, { before, limit }: { before?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (before !== undefined) params.set('before', before);
    if (limit !== undefined) params.set('limit', String(limit));

    const query = params.toString();
    return backendClient<ChatMessagePage>(
      `/chat/${peerId}/messages${query === '' ? '' : `?${query}`}`,
    );
  },

  markRead: (peerId: number) =>
    backendClient<ChatReadResponse>(`/chat/${peerId}/read`, { method: 'POST' }),
};
