<script setup lang="ts">
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { useChatStore, type Chat } from '@/stores/chat';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Search, X } from '@lucide/vue';
import { formatTime } from '@/lib/format';
import { useChatSearch } from '@/composables/chat/useChatSearch';
import { storeToRefs } from 'pinia';
import { useFriendsStore } from '@/stores/friends';
import UserAvatar from '../UserAvatar.vue';
import { onMounted } from 'vue';

const chatStore = useChatStore();
const { activeChat } = storeToRefs(chatStore);
const friendsStore = useFriendsStore();
const { isLoading: friendsLoading } = storeToRefs(friendsStore);

const { searchTerm, filteredChats, filteredFriendsWithoutChat, clearSearch } = useChatSearch();

function lastMessageOf(chat: Chat) {
  return chat.messages.at(-1) ?? null;
}

onMounted(() => friendsStore.ensureLoaded());
</script>

<template>
  <aside
    class="w-full h-full sm:w-80 min-h-0 border-r border-white/10 flex-col"
    :class="activeChat ? 'hidden sm:flex' : 'flex'"
  >
    <div class="p-4 border-b border-white/10">
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

    <ScrollArea class="flex-1 min-h-0">
      <Button
        variant="ghost"
        v-for="chat in filteredChats"
        :key="chat.friend.id"
        @click="chatStore.selectChat(chat)"
        class="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors h-auto justify-start"
        :class="activeChat?.friend.id === chat.friend.id && 'bg-white/10'"
      >
        <UserAvatar :image="chat.friend.image" :username="chat.friend.username" />

        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-baseline">
            <Skeleton v-if="friendsLoading" class="h-4 w-20" />
            <span v-else class="font-medium truncate">{{ chat.friend.username }}</span>
            <span v-if="lastMessageOf(chat)" class="text-xs text-muted-foreground shrink-0 ml-2">
              {{ formatTime(lastMessageOf(chat)!.timestamp) }}
            </span>
          </div>
          <p class="text-sm text-muted-foreground truncate">
            {{ lastMessageOf(chat)?.message ?? 'No messages yet' }}
          </p>
        </div>
      </Button>

      <p
        v-if="filteredChats.length === 0 && !searchTerm.trim()"
        class="p-4 text-sm text-muted-foreground text-center"
      >
        No chats yet.
      </p>

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
            clearSearch();
          "
          class="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors h-auto justify-start"
        >
          <UserAvatar :image="friend.image" :username="friend.username" />
          <span class="font-medium truncate">{{ friend.username }}</span>
        </Button>
      </template>

      <p
        v-if="
          searchTerm.trim() && filteredChats.length === 0 && filteredFriendsWithoutChat.length === 0
        "
        class="p-4 text-sm text-muted-foreground text-center"
      >
        No results found.
      </p>
    </ScrollArea>
  </aside>
</template>
