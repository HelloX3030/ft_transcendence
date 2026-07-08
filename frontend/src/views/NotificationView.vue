<script lang="ts" setup>
import Button from '@/components/ui/button/Button.vue';
import { Card } from '@/components/ui/card';
import { notifyStore } from '@/stores/notify.ts';

const notify = notifyStore();
</script>

<template>
  <div class="flex max-w-1xl flex-col gap-6 p-6">
    <div class="flex items-center justify-items-center">
      <h1 class="flex-auto pr-2 text-2xl font-bold">Notifications</h1>
      <Button
        @click="notify.clearAllNotifications"
        variant="outline"
        type="button"
        class="items-baseline"
      >
        Clear all
      </Button>
    </div>
    <span
      v-if="notify.count <= 0"
      class="flex flex-initial items-baseline self-center gap-4 p-4 rounded-full bg-muted px-4 text-s"
    >
      You don't have any new notifications.
    </span>
    <Card
      v-for="notification in notify.notifyMsg"
      :key="notification.id"
      class="flex flex-row p-3 gap-y-1 items-center justify-items-center"
    >
      <span
        class="flex flex-initial items-baseline gap-4 p-0 rounded-full bg-muted px-2 py-1 text-xs"
      >
        {{ notification.titel }}
      </span>
      <div class="flex flex-col flex-auto">
        <p class="text-sm">
          {{ notification.msg }}
        </p>
        <p class="self-end text-xs text-muted-foreground">
          {{ notification.date }}
        </p>
      </div>
    </Card>
  </div>
</template>
