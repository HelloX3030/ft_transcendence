<script setup lang="ts">
import { Search, Send, ArrowLeft } from 'lucide-vue-next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { useChatList } from '@/composables/chat/useChatList';
import { useChatConversation } from '@/composables/chat/useChatConversation';

const {
  getUser,
  friendsLoading,
  selectedUserId,
  selectedChat,
  selectChat,
  searchQuery,
  filteredChats,
  filteredNewFriends,
  startNewChat,
  lastMessageOf,
  formatTime,
} = useChatList();

const { currentUserId, newMessage, sendMessage, getMessageClass, messagesEndRef, systemSenderId } =
  useChatConversation(selectedChat);
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
          :class="selectedUserId === chat.userId && 'bg-white/10'"
        >
          <Avatar class="h-10 w-10 shrink-0">
            <AvatarImage v-if="getUser(chat.userId)?.image" :src="getUser(chat.userId)!.image!" />
            <AvatarFallback>
              {{ getUser(chat.userId)?.username.charAt(0) ?? '?' }}
            </AvatarFallback>
          </Avatar>

          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline">
              <Skeleton v-if="friendsLoading" class="h-4 w-20" />
              <span v-else class="font-medium truncate">
                {{ getUser(chat.userId)?.username ?? chat.userId }}
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
            v-for="friend in filteredNewFriends"
            :key="friend.id"
            @click="startNewChat(friend.id)"
            class="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
          >
            <Avatar class="h-10 w-10 shrink-0">
              <AvatarImage v-if="friend.image" :src="friend!.image!" />
              <AvatarFallback>
                {{ friend.username.charAt(0) ?? '?' }}
              </AvatarFallback>
            </Avatar>
            <span class="font-medium truncate">
              {{ friend.username }}
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

          <Avatar class="h-9 w-9">
            <AvatarImage
              v-if="getUser(selectedChat.userId)?.image"
              :src="getUser(selectedChat.userId)!.image!"
            />
            <AvatarFallback>
              {{ getUser(selectedChat.userId)?.username.charAt(0) ?? '?' }}
            </AvatarFallback>
          </Avatar>
          <Skeleton v-if="friendsLoading" class="h-4 w-24" />
          <span v-else class="font-medium">
            {{ getUser(selectedChat.userId)?.username ?? selectedChat.userId }}
          </span>
        </header>

        <ScrollArea class="flex-1 p-4">
          <div
            v-if="selectedChat.messages.length === 0"
            class="h-full flex items-center justify-center text-muted-foreground text-sm text-center"
          >
            Say hi to {{ getUser(selectedChat.userId)?.username ?? 'your friend' }} 👋
          </div>
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="(msg, i) in selectedChat.messages"
              :key="i"
              class="max-w-[85%] sm:max-w-[70%] flex flex-col"
              :class="getMessageClass(msg)"
            >
              <div
                v-if="msg.senderId !== systemSenderId"
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
                v-if="msg.senderId !== systemSenderId"
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
          <Input v-model="newMessage" placeholder="Type a message..." class="flex-1" />
          <Button type="submit" size="icon">
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
