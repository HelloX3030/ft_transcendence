<script setup lang="ts">
import type { Friend, GetUserResponse } from '@trailertinder/shared';
import { onMounted, ref } from 'vue';
import { userApi } from '@/api/endpoints/user';
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

const props = defineProps<Friend>();
const router = useRouter();
const friendsStore = useFriendsStore();

const userDetail = ref<GetUserResponse>();

onMounted(async () => {
  userDetail.value = await userApi.getById(props.friendId);
});

async function handleDelete() {
  try {
    await friendsStore.deleteFriend(props.friendId);
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
      <Avatar class="size-10">
        <AvatarImage
          v-if="userDetail && userDetail.image"
          :src="userDetail?.image"
          :alt="userDetail.username"
        />
        <AvatarFallback><UserIcon /></AvatarFallback>
      </Avatar>
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ userDetail?.username }}</ItemTitle>
      <ItemDescription>
        Friend since {{ new Date(createdAt).toLocaleDateString() }}</ItemDescription
      >
    </ItemContent>
    <ItemActions>
      <DropdownMenu>
        <DropdownMenuTrigger as-child @click.stop class="">
          <Button variant="ghost" size="icon"> <Ellipsis /> </Button
        ></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem @click="router.push(`/profile/${friendId}`)">
            <ArrowUpRight /> Open</DropdownMenuItem
          >
          <DropdownMenuItem @click="handleDelete"><Trash /> Delete </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ItemActions>
  </Item>
</template>
