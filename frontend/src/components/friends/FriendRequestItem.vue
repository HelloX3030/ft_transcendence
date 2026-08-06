<script setup lang="ts">
import type { Friend, GetUserResponse } from '@cinemates/shared';
import { computed, onMounted, ref } from 'vue';
import { userApi } from '@/api/endpoints/user';
import { toast } from 'vue-sonner';
import UserAvatar from '../UserAvatar.vue';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle, ItemDescription } from '../ui/item';
import { Button } from '../ui/button';
import { Check, X } from '@lucide/vue';
import { useFriendsStore } from '@/stores/friends';
import { useUserStore } from '@/stores/user';

const props = defineProps<Friend>();
const friendsStore = useFriendsStore();
const { state: me } = useUserStore();
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
    await friendsStore.acceptRequest(otherUserId.value);
    toast.success(`Friend request from ${userDetail.value?.username} accepted`);
  } catch (error) {
    const message = (error as Error).message;
    toast.error(message);
  } finally {
    isProcessing.value = false;
  }
}

async function handleDecline() {
  isProcessing.value = true;
  try {
    await friendsStore.declineRequest(otherUserId.value);
    toast.success('Friend request declined');
  } catch (error) {
    const message = (error as Error).message;
    toast.error(message);
  } finally {
    isProcessing.value = false;
  }
}
</script>

<template>
  <Item variant="outline">
    <ItemMedia>
      <UserAvatar
        :avatar-file-id="userDetail?.avatarFileId"
        :username="userDetail?.username"
        class="size-10"
      />
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ userDetail?.username }}</ItemTitle>
      <ItemDescription v-if="!isIncoming" class="">Waiting for response… </ItemDescription>
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
