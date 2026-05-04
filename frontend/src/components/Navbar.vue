<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
</script>

<template>
  <nav class="border-b px-6 py-3 flex items-center justify-between gap-4">
    <Avatar>
      <AvatarImage src="https://github.com/shadcn.png" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>

    <RouterLink to="/">
      <div class="flex items-center">
        <img src="/logo-512x512.png" alt="logo" class="size-24" />

        <p class="text-lg font-medium hover:text-primary transition-colors">Trailer Tinder</p>
      </div>
    </RouterLink>

    <RouterLink
      to="/notifications"
      class="text-sm font-medium hover:text-primary transition-colors"
      active-class="text-primary"
    >
      notifications
    </RouterLink>
  </nav>
</template>
