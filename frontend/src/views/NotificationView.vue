<script lang="ts" setup>
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { Check, Trash2 } from '@lucide/vue';
import Button from '@/components/ui/button/Button.vue';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useNotificationsStore } from '@/stores/notifications';
import { notificationText, notificationTitle } from '@/lib/notification-text';
import { formatDateTime } from '@/lib/format';
import type { NotificationItem } from '@cinemates/shared';

const notifications = useNotificationsStore();
const { items, unreadCount, hasMore, isLoading, isLoadingMore, error } = storeToRefs(notifications);

// The socket seeds the inbox on connect, but a direct navigation to this route
// can land before that, and a hard reload has no socket yet at all.
onMounted(() => {
  if (items.value.length === 0) void notifications.load();
});

/** Where an item points, if anywhere: the watchlist it concerns, else the actor. */
function linkOf(notification: NotificationItem): string | null {
  if (notification.type.startsWith('watchlist.') && notification.entityId !== null) {
    return `/watchlist/${notification.entityId}`;
  }
  if (notification.actorId !== null) return `/users/${notification.actorId}`;
  return null;
}
</script>

<template>
  <div class="flex flex-1 max-w-3xl flex-col gap-6 p-6">
    <div class="flex items-center gap-2">
      <h1 class="flex-auto text-2xl font-bold">
        Notifications
        <span v-if="unreadCount > 0" class="text-base font-normal text-muted-foreground">
          ({{ unreadCount }} unread)
        </span>
      </h1>
      <Button
        v-if="unreadCount > 0"
        @click="notifications.markAllRead()"
        variant="outline"
        type="button"
      >
        Mark all read
      </Button>
      <Button
        v-if="items.length > 0"
        @click="notifications.clear()"
        variant="outline"
        type="button"
      >
        Clear all
      </Button>
    </div>

    <div v-if="isLoading && items.length === 0" class="flex flex-1 items-center justify-center">
      <Spinner class="size-10" />
    </div>

    <div v-else-if="error" class="flex flex-1 items-center justify-center">
      <p class="text-zinc-500">Couldn't load notifications: {{ error.message }}</p>
    </div>

    <div v-else-if="items.length === 0" class="flex flex-1 items-center justify-center">
      <p class="text-zinc-500">You don't have any notifications.</p>
    </div>

    <template v-else>
      <Card
        v-for="notification in items"
        :key="notification.id"
        class="flex flex-row p-3 gap-3 items-center"
        :class="notification.readAt === null && 'border-orange-500/50'"
      >
        <span class="flex flex-initial shrink-0 rounded-full bg-muted px-2 py-1 text-xs">
          {{ notificationTitle(notification.type) }}
        </span>

        <div class="flex flex-col flex-auto min-w-0">
          <component
            :is="linkOf(notification) ? 'RouterLink' : 'p'"
            :to="linkOf(notification) ?? undefined"
            class="text-sm"
            :class="linkOf(notification) && 'hover:underline'"
          >
            {{ notificationText(notification.type, notification.params) }}
          </component>
          <p class="self-end text-xs text-muted-foreground">
            {{ formatDateTime(notification.createdAt) }}
          </p>
        </div>

        <Button
          v-if="notification.readAt === null"
          @click="notifications.markRead(notification.id)"
          variant="ghost"
          size="icon"
          aria-label="Mark as read"
        >
          <Check class="size-4" />
        </Button>
        <Button
          @click="notifications.remove(notification.id)"
          variant="ghost"
          size="icon"
          aria-label="Delete notification"
        >
          <Trash2 class="size-4" />
        </Button>
      </Card>

      <Button
        v-if="hasMore"
        @click="notifications.loadMore()"
        :disabled="isLoadingMore"
        variant="outline"
        type="button"
        class="self-center"
      >
        {{ isLoadingMore ? 'Loading…' : 'Load more' }}
      </Button>
    </template>
  </div>
</template>
