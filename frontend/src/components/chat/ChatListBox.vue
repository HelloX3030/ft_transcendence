<script setup lang="ts">
import { useFilter } from 'reka-ui';
import { computed, ref, nextTick, watch } from 'vue';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';

import { useFriendsStore } from '@/stores/friends';
import { storeToRefs } from 'pinia';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

import { useChatStore, type Chat } from '@/stores/chat';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Search, X } from '@lucide/vue';

const chatStore = useChatStore();
const { activeChat, sortedChats } = storeToRefs(chatStore);
const friendsStore = useFriendsStore();
const { friendsDetails, isLoading: friendsLoading } = storeToRefs(friendsStore);

const searchTerm = ref('');
const { contains } = useFilter({ sensitivity: 'base' });

const filteredChats = computed(() => {
  const term = searchTerm.value.trim();

  if (!term) return sortedChats.value;

  const matched = sortedChats.value.filter((chat) => contains(chat.friend.username, term));

  return matched;
});

const filteredFriendsWithoutChat = computed(() => {
  const term = searchTerm.value.trim();
  if (!term) return [];

  return friendsDetails.value.filter((f) => contains(f.username, term) && !chatStore.getChat(f.id));
});

function lastMessageOf(chat: Chat) {
  if (chat.messages.length > 0) return chat.messages[chat.messages.length - 1];
  return null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function clearSearch() {
  searchTerm.value = '';
}
</script>

<template>
  <aside
    class="w-full h-full sm:w-80 border-r border-white/10 flex-col"
    :class="activeChat ? 'hidden sm:flex' : 'flex'"
  >
    <div class="p-4 border-b border-white/10 bg-slate-700">
      <InputGroup>
        <InputGroupInput v-model="searchTerm" placeholder="Search chats or friends..." />
        <InputGroupAddon>
          <InputGroupButton>
            <Search />
          </InputGroupButton>
        </InputGroupAddon>
        <InputGroupAddon v-if="searchTerm" align="inline-end">
          {{ filteredFriendsWithoutChat.length }} results
          <InputGroupButton @click="clearSearch">
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>

    <ScrollArea class="max-h-1/3">
      <Button
        variant="ghost"
        v-for="chat in sortedChats"
        :key="chat.friend.id"
        @click="chatStore.selectChat(chat)"
        class="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors h-auto justify-start"
        :class="activeChat?.friend.id === chat.friend.id && 'bg-white/10'"
      >
        <Avatar class="h-10 w-10 shrink-0">
          <AvatarImage v-if="chat.friend.image" :src="chat.friend.image" />
          <AvatarFallback>
            {{ chat.friend.username.charAt(0) ?? '?' }}
          </AvatarFallback>
        </Avatar>

        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-baseline">
            <Skeleton v-if="friendsLoading" class="h-4 w-20" />
            <span v-else class="font-medium truncate">
              {{ chat.friend.username }}
            </span>
            <span v-if="lastMessageOf(chat)" class="text-xs text-muted-foreground shrink-0 ml-2">
              {{ formatTime(lastMessageOf(chat)!.timestamp) }}
            </span>
          </div>
          <p class="text-sm text-muted-foreground truncate">
            {{ lastMessageOf(chat)?.message ?? 'No messages yet' }}
          </p>
        </div>
      </Button>
    </ScrollArea>

    <p
      v-if="filteredChats.length === 0 && !searchTerm.trim()"
      class="p-4 text-sm text-muted-foreground text-center"
    >
      No chats yet.
    </p>

    <!-- Start new chat: nur während der Suche, Friends ohne bestehenden Chat -->
    <ScrollArea class="bg-amber-400 max-h-2/3">
      <template v-if="searchTerm.trim() && filteredFriendsWithoutChat.length > 0">
        <p class="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Start new chat
        </p>
        <Button
          variant="ghost"
          v-for="friend in filteredFriendsWithoutChat"
          :key="friend.id"
          @click="
            chatStore.createChat(friend);
            searchTerm = '';
          "
          class="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors h-auto justify-start"
        >
          <Avatar class="h-10 w-10 shrink-0">
            <AvatarImage v-if="friend.image" :src="friend.image!" />
            <AvatarFallback>
              {{ friend.username.charAt(0) ?? '?' }}
            </AvatarFallback>
          </Avatar>
          <span class="font-medium truncate">
            {{ friend.username }}
          </span>
        </Button>
      </template>
    </ScrollArea>

    <p
      v-if="
        searchTerm.trim() && filteredChats.length === 0 && filteredFriendsWithoutChat.length === 0
      "
      class="p-4 text-sm text-muted-foreground text-center"
    >
      No results found.
    </p>
  </aside>
</template>
