<script lang="ts" setup>
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { notifyStore } from '@/stores/notify.ts';

const notify = notifyStore();
</script>

<template>
  <div class="flex max-w-1xl flex-col gap-6 p-6">
    <div class="flex items-center">
      <h1 class="flex-auto pr-2 text-2xl font-bold">Notifications</h1>
      <button
        @click="notify.clearAllNotifications"
        class="rounded-full bg-muted px-3 py-1 text-xs hover:brightness-125"
        type="button"
      >
        Clear all
      </button>
    </div>
    <Card
      v-for="notification in notify.notifyMsg"
      :key="notification.id"
      class="flex flex-row items-center p-3 gap-4"
    >
      <span class="rounded-full bg-muted px-2 py-1 text-xs">
        {{ notification.titel }}
      </span>

      <p class="text-sm text-muted-foreground">
        {{ notification.msg }}
      </p>
    </Card>
  </div>
</template>
