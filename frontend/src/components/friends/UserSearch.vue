<script setup lang="ts">
import { computed, ref } from 'vue';
import { Plus, Search, UserIcon, X } from '@lucide/vue';

import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';

import { useUserSearch } from '@/composables/useUserSearch';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { friendsApi } from '@/api/endpoints/friends';
import { toast } from 'vue-sonner';
import ItemGroup from '../ui/item/ItemGroup.vue';
import ItemSeparator from '../ui/item/ItemSeparator.vue';

const { search, resetSearch, searchStatus, searchData } = useUserSearch();

const inputQuery = ref('');

function handleSearch() {
  if (inputQuery.value.trim() === '') return;
  search({ query: inputQuery.value });
}

function handleClear() {
  inputQuery.value = '';
  resetSearch();
}

const hasResults = computed(() => !!searchData.value && searchData.value.results.length > 0);

async function sendFriendRequest(userId: number) {
  try {
    await friendsApi.sendRequest(userId);
    toast.success('Friend Request Successfully sent');
  } catch (error) {
    console.log(error);
    toast.warning('Friend Request Failed');
  }
}
</script>

<template>
  <form @submit.prevent="handleSearch">
    <div
      class="rounded-md border bg-transparent transition-colors"
      :class="hasResults ? 'border-input' : 'border-transparent'"
    >
      <InputGroup :class="['border-0', hasResults && 'rounded-b-none border-b border-input']">
        <InputGroupAddon>
          <Button type="submit" :variant="null" class="hover:text-primary" size="icon">
            <Search />
          </Button>
        </InputGroupAddon>
        <InputGroupInput placeholder="Search Users..." v-model="inputQuery" />
        <InputGroupAddon align="inline-end">
          <Spinner v-if="searchStatus === 'loading'" />
          <span v-else-if="searchStatus === 'ready' && searchData">
            {{ searchData.total }} found
          </span>
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <Button
            type="button"
            :variant="null"
            class="hover:text-primary"
            size="icon"
            :disabled="inputQuery === ''"
            @click="handleClear"
          >
            <X />
          </Button>
        </InputGroupAddon>
      </InputGroup>

      <div
        v-if="hasResults"
        class="p-2 space-y-1 max-h-40 md:max-h-80 overflow-y-auto scrollbar-thumb-primary"
      >
        <ItemGroup>
          <template v-for="(user, idx) in searchData!.results" :key="user.id">
            <Item>
              <ItemMedia>
                <Avatar class="size-10">
                  <AvatarImage v-if="user.image" :src="user.image" />
                  <AvatarFallback><UserIcon /></AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{{ user.username }}</ItemTitle>
              </ItemContent>
              <ItemActions>
                <Button
                  size="icon-sm"
                  variant="outline"
                  class="rounded-full hover:text-primary"
                  aria-label="Invite"
                  type="button"
                  @click="sendFriendRequest(user.id)"
                >
                  <Plus />
                </Button>
              </ItemActions>
            </Item>
            <ItemSeparator v-if="idx !== searchData!.results.length - 1" />
          </template>
        </ItemGroup>
      </div>
    </div>
  </form>
</template>
