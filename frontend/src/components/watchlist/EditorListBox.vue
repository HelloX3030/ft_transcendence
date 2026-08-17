<script setup lang="ts">
import { CheckIcon, ChevronDown } from '@lucide/vue';
import {
  ListboxContent,
  ListboxFilter,
  ListboxItem,
  ListboxItemIndicator,
  ListboxRoot,
  useFilter,
} from 'reka-ui';
import { computed, onMounted, ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from '@/components/ui/tags-input';
import { useFriendsStore } from '@/stores/friends';
import { storeToRefs } from 'pinia';
import UserAvatar from '../UserAvatar.vue';
import type { GetUserResponse } from '@cinemates/shared';
import { useUserStore } from '@/stores/user';

const selectedEditors = defineModel<number[]>();
const user = useUserStore();

const friendsStore = useFriendsStore();
const { friendsDetails } = storeToRefs(friendsStore);

// The editors to pick from are the user's friends, so this screen is one of the
// ones that has to ask for them.
onMounted(() => friendsStore.ensureLoaded());

const usersById = computed(() => {
  const map = new Map<number, GetUserResponse>();
  for (const f of friendsDetails.value) {
    map.set(f.id, f);
  }
  if (user.state)
    map.set(user.state.id, {
      username: user.state.username,
      id: user.state.id,
      avatarFileId: user.state.avatarFileId,
    });
  return map;
});

const searchTerm = ref('');
const open = ref(false);
const { contains } = useFilter({ sensitivity: 'base' });

const filteredFriends = computed(() =>
  searchTerm.value === ''
    ? friendsDetails.value
    : friendsDetails.value.filter((option) => contains(option.username, searchTerm.value)),
);

watch(searchTerm, (f) => {
  if (f) open.value = true;
});
</script>

<template>
  <Popover v-model:open="open">
    <ListboxRoot v-model="selectedEditors" highlight-on-hover multiple>
      <PopoverAnchor class="inline-flex w-full">
        <TagsInput v-slot="{ modelValue: tags }" v-model="selectedEditors" class="w-full">
          <template v-for="id in tags" :key="id.toString()">
            <TagsInputItem :value="id">
              <TagsInputItemText>{{
                usersById.get(Number(id.toString()))?.username ?? id
              }}</TagsInputItemText>
              <TagsInputItemDelete />
            </TagsInputItem>
          </template>

          <ListboxFilter v-model="searchTerm" as-child>
            <TagsInputInput
              placeholder="Add User to list..."
              @keydown.enter.prevent
              @keydown.down="open = true"
            />
          </ListboxFilter>

          <PopoverTrigger as-child>
            <Button size="icon-sm" variant="ghost" class="order-last self-start ml-auto">
              <ChevronDown class="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TagsInput>
      </PopoverAnchor>

      <PopoverContent class="p-1 w-[var(--reka-popper-anchor-width)]" @open-auto-focus.prevent>
        <ListboxContent
          class="max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto empty:after:content-['No_options'] empty:p-1 empty:after:block"
          tabindex="0"
        >
          <ListboxItem
            v-for="item in filteredFriends"
            :key="item.id"
            class="data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            :value="item.id"
            @select="
              () => {
                searchTerm = '';
              }
            "
          >
            <UserAvatar
              :avatar-file-id="item.avatarFileId"
              :username="item.username"
              class="size-8"
            />
            <span>{{ item.username }}</span>

            <ListboxItemIndicator class="ml-auto inline-flex items-center justify-center">
              <CheckIcon />
            </ListboxItemIndicator>
          </ListboxItem>
        </ListboxContent>
      </PopoverContent>
    </ListboxRoot>
  </Popover>
</template>
