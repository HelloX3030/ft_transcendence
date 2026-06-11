<script lang="ts" setup>
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-vue-next';
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 p-6">
    <h1 class="text-2xl font-bold">Friends</h1>
    <Card>
      <CardHeader class="items-center text-center">
        <Users class="text-muted-foreground size-10" />
        <CardTitle class="text-muted-foreground text-base font-medium">Coming soon</CardTitle>
      </CardHeader>
      <CardContent class="text-center">
        <p class="text-muted-foreground text-sm">
          Friend requests, online status, and chat are on the roadmap.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
