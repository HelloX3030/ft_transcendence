import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { DomainEvent, NotificationItem } from '@cinemates/shared';
import { notificationsApi } from '@/api/endpoints/notifications';
import { logger } from '@/lib/logger';

const PAGE_SIZE = 20;

/**
 * Server-backed inbox: list, unread count and the read/delete actions.
 *
 * Deliberately separate from the notify store — notify is transport (one socket,
 * one event router), this is domain state. The server owns the list, so nothing
 * here is authoritative; `reset()` drops the cache and a reload restores it.
 */
export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationItem[]>([]);
  const nextCursor = ref<string | null>(null);
  const unreadCount = ref(0);
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const error = ref<Error | null>(null);

  const hasMore = computed(() => nextCursor.value !== null);

  /**
   * Replaces the cache with the newest page. Called on login and on every socket
   * reconnect — a reconnect means events were missed while the socket was down,
   * and a refetch is what closes that gap.
   */
  async function load() {
    isLoading.value = true;
    error.value = null;
    try {
      const page = await notificationsApi.list({ limit: PAGE_SIZE });
      items.value = page.notifications;
      nextCursor.value = page.nextCursor;
      unreadCount.value = page.unreadCount;
    } catch (cause) {
      error.value = cause as Error;
      logger.debug('[notifications] failed to load inbox', cause);
    } finally {
      isLoading.value = false;
    }
  }

  async function loadMore() {
    if (nextCursor.value === null || isLoadingMore.value) return;

    isLoadingMore.value = true;
    try {
      const page = await notificationsApi.list({ cursor: nextCursor.value, limit: PAGE_SIZE });
      // Guard against a duplicate the server may re-send if a row was deleted
      // between pages; the list is keyed on id, so a repeat would render twice.
      const known = new Set(items.value.map(({ id }) => id));
      items.value.push(...page.notifications.filter(({ id }) => !known.has(id)));
      nextCursor.value = page.nextCursor;
      unreadCount.value = page.unreadCount;
    } catch (cause) {
      error.value = cause as Error;
      logger.debug('[notifications] failed to load more', cause);
    } finally {
      isLoadingMore.value = false;
    }
  }

  /**
   * Folds a live event into the cache. The event already carries every column of
   * the row it created, so there is nothing to fetch.
   */
  function ingest(event: DomainEvent) {
    if (event.notificationId === null) return;
    if (items.value.some(({ id }) => id === event.notificationId)) return;

    items.value.unshift({
      id: event.notificationId,
      type: event.type,
      actorId: event.actorId,
      entityId: event.entityId,
      params: event.params,
      readAt: null,
      createdAt: new Date(event.at).toISOString(),
    });
    unreadCount.value++;
  }

  async function markRead(id: number) {
    const item = items.value.find((entry) => entry.id === id);
    if (item === undefined || item.readAt !== null) return;

    const { unreadCount: count } = await notificationsApi.markRead(id);
    item.readAt = new Date().toISOString();
    unreadCount.value = count;
  }

  async function markAllRead() {
    const { unreadCount: count } = await notificationsApi.markAllRead();
    const readAt = new Date().toISOString();
    for (const item of items.value) {
      item.readAt ??= readAt;
    }
    unreadCount.value = count;
  }

  async function remove(id: number) {
    const { unreadCount: count } = await notificationsApi.remove(id);
    items.value = items.value.filter((entry) => entry.id !== id);
    unreadCount.value = count;
  }

  async function clear() {
    const { unreadCount: count } = await notificationsApi.clear();
    items.value = [];
    nextCursor.value = null;
    unreadCount.value = count;
  }

  /**
   * Drops the local cache only — the server keeps the inbox. Named `$reset` so
   * the Pinia reset plugin clears it on logout.
   */
  function $reset() {
    items.value = [];
    nextCursor.value = null;
    unreadCount.value = 0;
    error.value = null;
  }

  return {
    items,
    unreadCount,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    load,
    loadMore,
    ingest,
    markRead,
    markAllRead,
    remove,
    clear,
    $reset,
  };
});
