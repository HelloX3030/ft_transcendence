<script setup lang="ts">
import type { Friend, GetUserResponse } from '@trailertinder/shared';
import { computed, onMounted, ref } from 'vue';
import { userApi } from '@/api/endpoints/user';
import { friendsApi } from '@/api/endpoints/friends';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'vue-sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle, ItemDescription } from '../ui/item';
import { Button } from '../ui/button';
import { UserIcon, Check, X } from '@lucide/vue';

const props = defineProps<Friend>();
const emit = defineEmits<{
  (e: 'accepted', friendId: number): void;
  (e: 'declined', friendId: number): void;
}>();

const { user: me } = useAuthStore();
const userDetail = ref<GetUserResponse>();
const isProcessing = ref(false);

const isIncoming = computed(() => props.status === 'pending' && props.initiatorId !== me?.id);

const otherUserId = computed(() =>
  props.initiatorId === me?.id ? props.friendId : props.initiatorId,
);

onMounted(async () => {
  userDetail.value = await userApi.getById(otherUserId.value);
});

async function handleAccept() {
  isProcessing.value = true;
  try {
    await friendsApi.acceptRequest(props.initiatorId);
    toast.success(`Friend request from ${userDetail.value?.username} accepted`);
    emit('accepted', props.friendId);
  } catch (error) {
    console.error(error);
    toast.warning('Failed to accept friend request');
  } finally {
    isProcessing.value = false;
  }
}

async function handleDecline() {
  isProcessing.value = true;
  try {
    await friendsApi.delete(props.initiatorId);
    toast.success('Friend request declined');
    emit('declined', props.friendId);
  } catch (error) {
    console.error(error);
    toast.warning('Failed to decline friend request');
  } finally {
    isProcessing.value = false;
  }
}
</script>

<template>
  <Item variant="outline">
    <ItemMedia>
      <Avatar class="size-10">
        <AvatarImage v-if="userDetail?.image" :src="userDetail.image" :alt="userDetail.username" />
        <AvatarFallback><UserIcon /></AvatarFallback>
      </Avatar>
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ userDetail?.username }}</ItemTitle>
      <ItemDescription v-if="!isIncoming">Waiting for response…</ItemDescription>
    </ItemContent>
    <ItemActions>
      <template v-if="isIncoming">
        <Button
          size="icon-sm"
          variant="outline"
          class="rounded-full"
          :disabled="isProcessing"
          aria-label="Accept"
          @click="handleAccept"
        >
          <Check class="text-green-500" />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          class="rounded-full"
          :disabled="isProcessing"
          aria-label="Decline"
          @click="handleDecline"
        >
          <X class="text-red-500" />
        </Button>
      </template>
    </ItemActions>
  </Item>
</template>
