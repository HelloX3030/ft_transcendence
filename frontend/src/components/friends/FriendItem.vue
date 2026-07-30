<script setup lang="ts">
import type { GetUserResponse } from '@trailertinder/shared';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ArrowUpRight, Ellipsis, Trash, UserIcon } from '@lucide/vue';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '../ui/item';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu';
import { useRouter } from 'vue-router';
import { Button } from '../ui/button';
import { useFriendsStore } from '@/stores/friends';
import { toast } from 'vue-sonner';
import { useNotifyStore } from '@/stores/notify';
import PresenceDot from '../PresenceDot.vue';
import { fileUrl } from '@/lib/files';

interface Props extends GetUserResponse {
  createdAt: string | Date | undefined;
}

const props = defineProps<Props>();
const router = useRouter();
const friendsStore = useFriendsStore();
const notify = useNotifyStore();

async function handleDelete() {
  try {
    await friendsStore.deleteFriend(props.id);
    toast.success('Friend deleted successful');
  } catch (error) {
    const message = (error as Error).message;
    toast.error(message);
  }
}
</script>

<template>
  <Item variant="outline">
    <ItemMedia>
      <span class="relative inline-flex">
        <Avatar class="size-10">
          <AvatarImage v-if="avatarFileId" :src="fileUrl(avatarFileId)" :alt="username" />
          <AvatarFallback><UserIcon /></AvatarFallback>
        </Avatar>
        <PresenceDot overlay :online="notify.isUserOnline(id)" />
      </span>
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ username }}</ItemTitle>
      <ItemDescription v-if="createdAt">
        Friend since {{ new Date(createdAt).toLocaleDateString() }}</ItemDescription
      >
    </ItemContent>
    <ItemActions>
      <DropdownMenu>
        <DropdownMenuTrigger as-child @click.stop class="">
          <Button variant="ghost" size="icon"> <Ellipsis /> </Button
        ></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem @click="router.push(`/profile/${id}`)">
            <ArrowUpRight /> Open</DropdownMenuItem
          >
          <DropdownMenuItem @click="handleDelete"><Trash /> Delete </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ItemActions>
  </Item>
</template>
