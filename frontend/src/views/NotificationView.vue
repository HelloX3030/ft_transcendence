<script lang="ts" setup>
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { notifyStore } from '@/stores/notify.ts';

const notify = notifyStore();
</script>

<template>
  <div class="flex max-w-1xl flex-col gap-6 p-6">
    <h1 class="text-2xl font-bold">Notifications</h1>
    <Card v-for="notification in notify.notifyMsg" :key="notification.id">
      <CardHeader class="items-center text-center">
        {{ notification.titel }}
        <CardTitle class="text-muted-foreground text-base font-medium">{{
          notification.msg
        }}</CardTitle>
      </CardHeader>
      <CardContent class="text-center"> </CardContent>
    </Card>
  </div>
</template>
