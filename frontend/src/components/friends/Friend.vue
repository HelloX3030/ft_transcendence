<script setup lang="ts">
import type { Friend, GetUserResponse } from '@trailertinder/shared';
import { onMounted, ref } from 'vue';
import { userApi } from '@/api/endpoints/user';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ClockArrowRight, UserCheck, UserIcon } from '@lucide/vue';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '../ui/item';

const props = defineProps<Friend>();
const userDetail = ref<GetUserResponse>();
onMounted(async () => {
  userDetail.value = await userApi.getById(props.friendId);
});
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
    </ItemContent>
    <ItemActions>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            ><UserCheck v-if="props.status === 'accepted'" class="text-green-400" />
            <ClockArrowRight v-else class="text-yellow-400"
          /></TooltipTrigger>
          <TooltipContent>Status {{ status }} </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </ItemActions>
  </Item>
</template>
