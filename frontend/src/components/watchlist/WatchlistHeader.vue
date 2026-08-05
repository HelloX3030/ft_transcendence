<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pen, UserIcon } from '@lucide/vue';
import type { WatchlistMovieResponse, WatchlistResponse } from '@trailertinder/shared';
import { computed, ref } from 'vue';
import { Skeleton } from '../ui/skeleton';
import EditListDialog from './EditListDialog.vue';
import { useUserDetails } from '@/composables/useUserDetails.ts';
import { Button } from '../ui/button/index.ts';
import { fileUrl } from '@/lib/files';

interface PropsType {
  watchlist: WatchlistResponse;
  movies: WatchlistMovieResponse[];
}

const props = defineProps<PropsType>();

const { state: userDetails, isLoading: usersLoading } = useUserDetails(props.watchlist.editorIds);

const formattedDate = computed(() => {
  if (!props.watchlist.createdAt) return '';
  return new Date(props.watchlist.createdAt).toLocaleDateString('de-DE', {
    //TODO: replace 'de-DE'
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
});

const open = ref(false);
</script>

<template>
  <div class="flex flex-col gap-1 mb-8">
    <div class="flex items-start justify-between">
      <h1 class="font-bold text-2xl md:text-3xl xl:text-4xl">{{ watchlist.name }}</h1>
      <Button @click="open = !open" variant="ghost">
        <Pen />
      </Button>

      <EditListDialog
        :name="watchlist.name"
        :watchlist-id="watchlist.id"
        :movies="movies"
        :editors="watchlist.editorIds"
        v-model:open="open"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2 md:text-xl">
      <span class="text-muted-foreground">List by</span>
      <div class="flex items-center gap-2">
        <div
          class="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2"
        >
          <template v-if="usersLoading">
            <Skeleton
              v-for="value in watchlist.editorIds"
              :key="value"
              class="size-8 rounded-full"
            />
          </template>
          <TooltipProvider v-else-if="userDetails">
            <RouterLink
              v-for="(user, idx) in userDetails"
              :key="user.id"
              :to="`/profile/${user.id}`"
              :style="{ zIndex: userDetails.length - idx }"
            >
              <Tooltip>
                <TooltipTrigger
                  ><Avatar>
                    <AvatarImage
                      v-if="user.avatarFileId"
                      :src="fileUrl(user.avatarFileId)"
                      :alt="user.username"
                    />
                    <AvatarFallback>
                      <UserIcon class="size-4 text-muted-foreground" />
                    </AvatarFallback> </Avatar
                ></TooltipTrigger>
                <TooltipContent> {{ user.username }}</TooltipContent>
              </Tooltip>
            </RouterLink>
          </TooltipProvider>
        </div>
      </div>
      <span class="text-muted-foreground hidden sm:inline">·</span>
      <span class="text-muted-foreground">created at {{ formattedDate }}</span>
    </div>
  </div>
</template>
