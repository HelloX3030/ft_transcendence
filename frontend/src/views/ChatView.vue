<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Search, Send, ArrowLeft } from '@lucide/vue';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useFriendsStore } from '@/stores/friends';
import { storeToRefs } from 'pinia';
import { useUserDetails } from '@/composables/useUserDetails';
import { useNotifyStore } from '@/stores/notify';
import { userApi } from '@/api/endpoints/user';
import { useUserStore } from '@/stores/user';
import PresenceDot from '@/components/PresenceDot.vue';

// ---- Types ----
interface ChatMessage {
  timestamp: string;
  senderId: string;
  message: string;
}

interface Chat {
  userId: string;
  messages: ChatMessage[];
}

// ---- Current user ----
const userStore = useUserStore();
const { state: user } = storeToRefs(userStore);
const currentUserId = computed(() => user.value?.id.toString() ?? '');

// ---- Friends
const friendsStore = useFriendsStore();
const { acceptedFriends } = storeToRefs(friendsStore);
const friendIds = computed(() => acceptedFriends.value.map((f) => f.friendId.toString()));

// --- Notify ---
const notify = useNotifyStore();

watch(
  friendIds,
  async (ids) => {
    const missingIds = ids.map(Number).filter((id) => !userDetails.value.some((u) => u.id === id));

    if (missingIds.length === 0) return;

    const fetched = await Promise.all(missingIds.map((id) => userApi.getById(id)));
    userDetails.value.push(...fetched);
  },
  { immediate: true },
);

const chats = computed<Chat[]>(() =>
  Array.from(notify.chat, ([userId, messages]) => ({ userId, messages })),
);

// ---- User details laden: Chat-Partner UND Freunde zusammen ----
const allUserIds = computed(() => {
  const ids = new Set<number>();
  chats.value.forEach((c) => ids.add(Number(c.userId)));
  friendIds.value.forEach((id) => ids.add(Number(id)));
  return Array.from(ids);
});

const { state: userDetails, isLoading: usersLoading } = useUserDetails(allUserIds.value);

function getUser(id: string) {
  const u = userDetails.value.find((u) => u.id === Number(id));
  if (!u) return undefined;
  return { displayName: u.username, avatarUrl: u.image ?? undefined };
}

// ---- Selection state ----
const selectedUserId = ref<string | null>(chats.value[0]?.userId ?? null);

const selectedChat = computed<Chat | undefined>(() =>
  chats.value.find((c) => c.userId === selectedUserId.value),
);

function selectChat(userId: string) {
  selectedUserId.value = userId;
}

// ---- Search ----
const searchQuery = ref('');

const filteredChats = computed(() => {
  if (!searchQuery.value.trim()) return chats.value;
  const q = searchQuery.value.toLowerCase();
  return chats.value.filter((c) => getUser(c.userId)?.displayName.toLowerCase().includes(q));
});

const lastMessageOf = (chat: Chat) => chat.messages[chat.messages.length - 1];

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

// ---- New message input ----
const newMessage = ref('');

// The gateway refuses to relay to an offline peer, so sending would come straight
// back as a system error in the transcript. Block it at the composer instead.
const peerOnline = computed(() =>
  selectedChat.value ? notify.isUserOnline(selectedChat.value.userId) : false,
);

function sendMessage() {
  if (!newMessage.value.trim() || !selectedChat.value || !peerOnline.value) return;

  const peerUserId = selectedChat.value.userId;
  const messageText = newMessage.value.trim();

  // No local echo: the backend relays the message back to every tab of the
  // sender, so rendering it here as well would show it twice.
  notify.sendChatMsg(Number(peerUserId), messageText);
  newMessage.value = '';
}

function getMessageClass(msg: ChatMessage) {
  if (msg.senderId === currentUserId.value) {
    return 'self-end items-end';
  } else if (msg.senderId === notify.SYSTEM_SENDER_ID) {
    return 'self-center items-center';
  } else {
    return 'self-start items-start';
  }
}

// ---- Auto-scroll ----
const messagesEndRef = ref<HTMLElement | null>(null);

function scrollToBottom() {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
}

watch(selectedUserId, () => {
  scrollToBottom();
});

watch(
  () => selectedChat.value?.messages.length,
  () => {
    scrollToBottom();
  },
);

// ---- Freunde ohne bestehenden Chat ----
const friendsWithoutChat = computed(() =>
  friendIds.value.filter((id) => !chats.value.some((c) => c.userId === id)),
);

const filteredNewFriends = computed(() => {
  if (!searchQuery.value.trim()) return [];
  const q = searchQuery.value.toLowerCase();
  return friendsWithoutChat.value.filter((id) =>
    getUser(id)?.displayName.toLowerCase().includes(q),
  );
});

function startNewChat(userId: string) {
  notify.createChat(userId);
  selectChat(userId);
  searchQuery.value = '';
}
</script>

<template>
  <div class="flex h-full overflow-hidden relative">
    <!-- Left column: Search + Chat list -->
    <aside
      class="w-full sm:w-80 border-r border-white/10 flex-col shrink-0"
      :class="selectedChat ? 'hidden sm:flex' : 'flex'"
    >
      <div class="p-4 border-b border-white/10">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search chats or friends..." class="pl-9" />
        </div>
      </div>

      <ScrollArea class="flex-1">
        <button
          v-for="chat in filteredChats"
          :key="chat.userId"
          @click="selectChat(chat.userId)"
          class="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
          :class="selectedUserId === chat.userId ? 'bg-white/10' : ''"
        >
          <span class="relative inline-flex shrink-0">
            <Avatar class="h-10 w-10">
              <AvatarImage
                v-if="getUser(chat.userId)?.avatarUrl"
                :src="getUser(chat.userId)!.avatarUrl!"
              />
              <AvatarFallback>
                {{ getUser(chat.userId)?.displayName.charAt(0) ?? '?' }}
              </AvatarFallback>
            </Avatar>
            <PresenceDot overlay :online="notify.isUserOnline(chat.userId)" />
          </span>

          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline">
              <Skeleton v-if="usersLoading" class="h-4 w-20" />
              <span v-else class="font-medium truncate">
                {{ getUser(chat.userId)?.displayName ?? chat.userId }}
              </span>
              <span v-if="lastMessageOf(chat)" class="text-xs text-muted-foreground shrink-0 ml-2">
                {{ formatTime(lastMessageOf(chat)!.timestamp) }}
              </span>
            </div>
            <p class="text-sm text-muted-foreground truncate">
              {{ lastMessageOf(chat)?.message ?? 'No messages yet' }}
            </p>
          </div>
        </button>

        <p
          v-if="filteredChats.length === 0 && !searchQuery.trim()"
          class="p-4 text-sm text-muted-foreground text-center"
        >
          No chats yet.
        </p>

        <!-- Start new chat: only shown while searching, friends without an existing chat -->
        <template v-if="filteredNewFriends.length > 0">
          <p
            class="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide"
          >
            Start new chat
          </p>
          <button
            v-for="friendId in filteredNewFriends"
            :key="friendId"
            @click="startNewChat(friendId)"
            class="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
          >
            <Avatar class="h-10 w-10 shrink-0">
              <AvatarImage
                v-if="getUser(friendId)?.avatarUrl"
                :src="getUser(friendId)!.avatarUrl!"
              />
              <AvatarFallback>
                {{ getUser(friendId)?.displayName.charAt(0) ?? '?' }}
              </AvatarFallback>
            </Avatar>
            <span class="font-medium truncate">
              {{ getUser(friendId)?.displayName ?? friendId }}
            </span>
          </button>
        </template>

        <p
          v-if="searchQuery.trim() && filteredChats.length === 0 && filteredNewFriends.length === 0"
          class="p-4 text-sm text-muted-foreground text-center"
        >
          No results found.
        </p>
      </ScrollArea>
    </aside>

    <!-- Right column: Active chat -->
    <section class="flex-1 flex-col" :class="selectedChat ? 'flex' : 'hidden sm:flex'">
      <template v-if="selectedChat">
        <header class="p-4 border-b border-white/10 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            class="sm:hidden -ml-2"
            @click="selectedUserId = null"
          >
            <ArrowLeft class="h-5 w-5" />
          </Button>

          <span class="relative inline-flex shrink-0">
            <Avatar class="h-9 w-9">
              <AvatarImage
                v-if="getUser(selectedChat.userId)?.avatarUrl"
                :src="getUser(selectedChat.userId)!.avatarUrl!"
              />
              <AvatarFallback>
                {{ getUser(selectedChat.userId)?.displayName.charAt(0) ?? '?' }}
              </AvatarFallback>
            </Avatar>
            <PresenceDot overlay :online="notify.isUserOnline(selectedChat.userId)" />
          </span>
          <Skeleton v-if="usersLoading" class="h-4 w-24" />
          <div v-else class="flex flex-col">
            <span class="font-medium">
              {{ getUser(selectedChat.userId)?.displayName ?? selectedChat.userId }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ notify.isUserOnline(selectedChat.userId) ? 'Online' : 'Offline' }}
            </span>
          </div>
        </header>

        <ScrollArea class="flex-1 p-4">
          <div
            v-if="selectedChat.messages.length === 0"
            class="h-full flex items-center justify-center text-muted-foreground text-sm text-center"
          >
            Say hi to {{ getUser(selectedChat.userId)?.displayName ?? 'your friend' }} 👋
          </div>
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="(msg, i) in selectedChat.messages"
              :key="i"
              class="max-w-[85%] sm:max-w-[70%] flex flex-col"
              :class="getMessageClass(msg)"
            >
              <div
                v-if="msg.senderId !== notify.SYSTEM_SENDER_ID"
                class="rounded-2xl px-4 py-2 text-sm"
                :class="
                  msg.senderId === currentUserId
                    ? 'bg-orange-500 text-black'
                    : 'bg-white/10 text-white'
                "
              >
                {{ msg.message }}
              </div>
              <div v-else class="px-4 py-2 text-sm text-white">
                {{ msg.message }}
              </div>
              <span
                v-if="msg.senderId !== notify.SYSTEM_SENDER_ID"
                class="text-[11px] text-muted-foreground mt-1"
              >
                {{ formatTime(msg.timestamp) }}
              </span>
            </div>
            <div ref="messagesEndRef" />
          </div>
        </ScrollArea>

        <form
          @submit.prevent="sendMessage"
          class="p-4 border-t sticky bottom-0 bg-background border-white/10 flex gap-2"
        >
          <Input
            v-model="newMessage"
            :disabled="!peerOnline"
            :placeholder="
              peerOnline
                ? 'Type a message...'
                : `${getUser(selectedChat.userId)?.displayName ?? 'This user'} is offline`
            "
            class="flex-1"
          />
          <Button type="submit" size="icon" :disabled="!peerOnline">
            <Send class="h-4 w-4" />
          </Button>
        </form>
      </template>

      <div v-else class="flex-1 items-center justify-center text-muted-foreground hidden sm:flex">
        Select a chat to get started.
      </div>
    </section>
  </div>
</template>
