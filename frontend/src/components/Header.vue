<script lang="ts" setup>
import { computed } from 'vue';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Bell, WifiOff } from '@lucide/vue';
import Separator from './ui/separator/Separator.vue';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDelayedLoading } from '@/composables/useDelayedLoading';
import { useNotifyStore } from '@/stores/notify.ts';
import { useNotificationsStore } from '@/stores/notifications.ts';

const notify = useNotifyStore();
const notifications = useNotificationsStore();

const isReconnecting = computed(() => notify.connectionStatus === 'connecting');
const isDisconnected = computed(() => notify.connectionStatus === 'offline');

// `immediate` because notify.init() runs from main.ts before the app mounts, so
// the status is usually already 'connecting' by the time this component exists;
// there would be no transition left for the watcher to see. The long delay keeps
// an ordinary handshake, which takes a few hundred ms, entirely silent.
const showReconnecting = useDelayedLoading(isReconnecting, {
  delay: 1500,
  minDuration: 600,
  immediate: true,
});
</script>

<template>
  <header class="flex h-[var(--header-height)] shrink-0 items-center">
    <div class="grid grid-cols-3 w-full items-center px-9">
      <!-- Links: Sidebar -->
      <div class="flex justify-start">
        <SidebarTrigger />
      </div>

      <!-- Mitte: Logo -->
      <div class="flex justify-center">
        <RouterLink to="/">
          <p class="text-2xl tracking-tight">
            <span class="font-light text-white">Cine</span
            ><span class="font-bold text-orange-500">mates</span>
          </p>
        </RouterLink>
      </div>

      <!-- Rechts: Verbindungsstatus + Bell -->
      <div class="flex justify-end items-center gap-3">
        <Tooltip v-if="showReconnecting || isDisconnected">
          <TooltipTrigger as-child>
            <span
              role="status"
              aria-live="polite"
              :aria-label="
                isDisconnected
                  ? 'Disconnected, live updates are paused'
                  : 'Reconnecting, live updates are paused'
              "
              class="flex items-center"
            >
              <Spinner
                v-if="showReconnecting"
                class="size-4 text-muted-foreground motion-reduce:animate-none"
              />
              <WifiOff v-else class="size-4 text-destructive" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {{
              isDisconnected
                ? 'Disconnected. Live updates are paused. Try reloading.'
                : 'Reconnecting… live updates are paused.'
            }}
          </TooltipContent>
        </Tooltip>

        <RouterLink
          to="/notifications"
          class="hover:text-primary transition-colors"
          active-class="text-primary"
        >
          <div class="relative inline-block">
            <Bell class="size-6" />

            <span
              v-if="notifications.unreadCount > 0"
              class="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-xs font-bold text-white"
            >
              {{ notifications.unreadCount }}
            </span>
          </div>
        </RouterLink>
      </div>
    </div>
  </header>
  <Separator orientation="horizontal" />
</template>
