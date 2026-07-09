<script setup lang="ts">
import type { Friend, GetUserResponse } from '@trailertinder/shared';
import { Card, CardAction, CardHeader, CardTitle } from '../ui/card';
import { computed, onMounted, ref } from 'vue';
import { userApi } from '@/api/endpoints/user';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ClockArrowRight, UserCheck, UserIcon } from '@lucide/vue';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const props = defineProps<Friend>();
const userDetail = ref<GetUserResponse>();
onMounted(async () => {
  userDetail.value = await userApi.getById(props.friendId);
});
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2"
        ><Avatar>
          <AvatarImage
            v-if="userDetail && userDetail.image"
            :src="userDetail?.image"
            :alt="userDetail.username"
          />
          <AvatarFallback>
            <UserIcon class="size-4 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        {{ userDetail?.username }}
      </CardTitle>
      <CardAction>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              ><UserCheck v-if="props.status === 'accepted'" /> <ClockArrowRight v-else
            /></TooltipTrigger>
            <TooltipContent> {{ status }} </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardAction>
    </CardHeader>
  </Card>
</template>
