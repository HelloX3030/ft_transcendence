<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { MESSAGE_MAX_LENGTH } from '@cinemates/shared';
import { Send, ArrowLeft, ArrowDown, Dot } from '@lucide/vue';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { storeToRefs } from 'pinia';
import { useChatStore } from '@/stores/chat';
import { useNotifyStore } from '@/stores/notify';
import ChatMessage from '@/components/chat/ChatMessage.vue';
import { useSendMessage } from '@/composables/chat/useSendMessage';
import UserAvatarLink from '../UserAvatarLink.vue';

/** How close to the bottom still counts as "following the conversation". */
const BOTTOM_THRESHOLD_PX = 100;

const chatStore = useChatStore();
const notifyStore = useNotifyStore();
const { activeChat } = storeToRefs(chatStore);

// Purely informational now: an offline peer is messaged like any other and the
// message is waiting for them when they next log in.
const peerOnline = computed(() =>
  activeChat.value ? notifyStore.isUserOnline(activeChat.value.friend.id) : false,
);

const { inputMsg, sendMessage } = useSendMessage();

/**
 * Shown only once the limit is within reach. `maxlength` alone stops the typing
 * and silently drops the tail of a paste, which is its own small mystery, this
 * says what happened while there is still something to do about it.
 */
const HINT_REMAINING = 100;
const remaining = computed(() => MESSAGE_MAX_LENGTH - inputMsg.value.length);

const viewport = ref<HTMLElement | null>(null);
const topSentinel = ref<HTMLElement | null>(null);
const sentinelVisible = ref(false);
const isAtBottom = ref(true);
const hasNewBelow = ref(false);
let observer: IntersectionObserver | null = null;

function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  const element = viewport.value;
  if (!element) return;
  element.scrollTo({ top: element.scrollHeight, behavior });
  hasNewBelow.value = false;
}

function onScroll() {
  const element = viewport.value;
  if (!element) return;

  const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
  isAtBottom.value = distance <= BOTTOM_THRESHOLD_PX;
  if (isAtBottom.value) {
    hasNewBelow.value = false;
    // Read on reaching the bottom, not on open: marking read the moment the
    // window opens clears the badge while the user is still in scrollback.
    if (activeChat.value) void chatStore.markRead(activeChat.value);
  }
}

/**
 * Loads the next older page without moving the viewport.
 *
 * Prepending content grows `scrollHeight` above the current position, so
 * `scrollTop` has to grow by exactly the same amount, otherwise the user is
 * thrown backwards through the history they were reading, which makes correct
 * data feel broken.
 */
async function loadOlder() {
  const chat = activeChat.value;
  const element = viewport.value;
  if (!chat || !element || !chat.hasMore || chat.isLoadingOlder) return;

  const heightBefore = element.scrollHeight;
  const topBefore = element.scrollTop;

  await chatStore.loadOlder(chat);
  await nextTick();

  element.scrollTop = topBefore + (element.scrollHeight - heightBefore);
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      sentinelVisible.value = entries[0]?.isIntersecting ?? false;
    },
    { root: viewport.value, rootMargin: '120px' },
  );
  if (topSentinel.value) observer.observe(topSentinel.value);
});

onBeforeUnmount(() => observer?.disconnect());

// Same shape as MovieBrowser's infinite scroll, inverted: the observer only
// tracks visibility, and a watcher pulls pages while the sentinel stays in view.
watch([sentinelVisible, () => activeChat.value?.hasMore], () => {
  if (sentinelVisible.value) void loadOlder();
});

// Opening a chat starts at the newest message.
watch(
  () => activeChat.value?.friend.id,
  async () => {
    isAtBottom.value = true;
    hasNewBelow.value = false;
    await nextTick();
    scrollToBottom();
  },
);

// The first page arrives asynchronously, so anchor to the bottom once it lands.
watch(
  () => activeChat.value?.isLoaded,
  async (isLoaded) => {
    if (!isLoaded) return;
    await nextTick();
    scrollToBottom();
    if (activeChat.value) void chatStore.markRead(activeChat.value);
  },
);

// A message arriving while the user is scrolled up must not yank the view; they
// get a pill instead and decide for themselves.
watch(
  () => activeChat.value?.messages.length,
  async (length, previous) => {
    if (length === undefined || previous === undefined || length <= previous) return;
    if (!isAtBottom.value) {
      hasNewBelow.value = true;
      return;
    }
    await nextTick();
    scrollToBottom();
    if (activeChat.value) void chatStore.markRead(activeChat.value);
  },
);
</script>

<template>
  <!-- min-w-0: a flex item's default min-width is auto, i.e. its min-content
       size. A message containing one unbreakable token (a URL, a pasted hash)
       has a min-content width of the whole token, so without this the chat
       column refuses to shrink and the conversation list is squeezed instead. -->
  <section
    class="flex-1 min-w-0 flex-col relative min-h-0"
    :class="activeChat ? 'flex' : 'hidden sm:flex'"
  >
    <template v-if="activeChat">
      <div class="p-4 border-b border-white/10 flex items-center gap-3">
        <Button variant="ghost" size="icon" class="sm:hidden -ml-2" @click="chatStore.closeChat()">
          <ArrowLeft class="h-5 w-5" />
        </Button>

        <UserAvatarLink
          :user-id="activeChat.friend.id"
          :avatar-file-id="activeChat.friend.avatarFileId"
          :username="activeChat.friend.username"
        />
        <span class="font-medium">{{ activeChat.friend.username }}</span>

        <div class="flex items-center">
          <Dot :class="peerOnline ? 'text-green-400' : 'text-red-600'" />
          <span class="text-muted-foreground text-sm">
            {{ peerOnline ? 'online' : 'offline' }}
          </span>
        </div>
      </div>

      <!-- overflow-x-hidden is insurance, not the fix: the bubble's
           wrap-anywhere is what leaves nothing to overflow. It stays so a
           future unwrappable element cannot push the column wide. -->
      <div
        ref="viewport"
        class="p-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        @scroll.passive="onScroll"
      >
        <div ref="topSentinel" class="h-px" />

        <div v-if="activeChat.isLoadingOlder" class="flex justify-center py-2">
          <Spinner class="size-5" />
        </div>

        <div
          v-if="activeChat.messages.length === 0"
          class="h-full flex items-center justify-center text-muted-foreground text-sm text-center"
        >
          Say hi to {{ activeChat.friend.username }} 👋
        </div>
        <ChatMessage v-else v-bind="activeChat" />
      </div>

      <Button
        v-if="hasNewBelow"
        variant="secondary"
        size="sm"
        class="absolute bottom-24 left-1/2 -translate-x-1/2 shadow-lg"
        @click="scrollToBottom('smooth')"
      >
        <ArrowDown class="size-4" />
        New messages
      </Button>

      <form
        @submit.prevent="sendMessage(activeChat)"
        class="p-4 border-t sticky bottom-0 bg-background border-white/10 flex items-center gap-2"
      >
        <Input
          v-model="inputMsg"
          :maxlength="MESSAGE_MAX_LENGTH"
          placeholder="Type a message..."
          class="flex-1"
        />
        <span
          v-if="remaining <= HINT_REMAINING"
          class="text-xs tabular-nums"
          :class="remaining === 0 ? 'text-destructive' : 'text-muted-foreground'"
        >
          {{ remaining }}
        </span>
        <Button type="submit" size="icon">
          <Send />
        </Button>
      </form>
    </template>

    <div v-else class="flex-1 items-center justify-center text-muted-foreground hidden sm:flex">
      Select a chat to get started.
    </div>
  </section>
</template>
