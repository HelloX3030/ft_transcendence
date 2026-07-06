<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserIcon } from '@lucide/vue';
import type {
  GetUserResponse,
  WatchlistMovieResponse,
  WatchlistResponse,
} from '@trailertinder/shared';
import { computed, ref } from 'vue';
import { Skeleton } from '../ui/skeleton';
import EditListDialog from './EditListDialog.vue';

interface PropsType {
  watchlist: WatchlistResponse;
  movies: WatchlistMovieResponse[];
  editors: GetUserResponse[];
  editorsLoading: boolean;
}

const props = defineProps<PropsType>();

const editors2 = ref([
  { id: 1, username: 'philipp', image: 'https://github.com/shadcn.png' },
  {
    id: 2,
    username: 'urbi',
    image: 'https://github.com/leerob.png',
  },
  { id: 3, username: 'XxXMussiePeisterXxX', image: null },
]);

const formattedDate = computed(() => {
  if (!props.watchlist.createdAt) return '';
  return new Date(props.watchlist.createdAt).toLocaleDateString('de-DE', {
    //TODO: replace 'de-DE'
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
});
</script>

<template>
  <div class="flex flex-col gap-1 mb-8">
    <div class="flex items-start justify-between">
      <h1 class="font-bold text-2xl md:text-3xl xl:text-4xl">{{ watchlist.name }}</h1>
      <EditListDialog :name="watchlist.name" :movies="movies" :watchlist-id="watchlist.id" />
    </div>

    <div class="flex flex-wrap items-center gap-2 md:text-xl">
      <span class="text-muted-foreground">List by</span>
      <div class="flex items-center gap-2">
        <div
          class="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2"
        >
          <div v-if="editorsLoading">
            <Skeleton
              v-for="value in watchlist.editorIds"
              :key="value"
              class="size-8 rounded-full"
            />
          </div>
          <!-- <p v-else-if="editorsError" class="text-sm text-destructive">
            Couldn't load editors {{ editorsError.message }}
          </p> -->
          <TooltipProvider v-else>
            <RouterLink
              v-for="(user, idx) in editors2"
              :key="user.id"
              :to="`/profile/${user.id}`"
              :style="{ zIndex: editors2.length - idx }"
            >
              <Tooltip>
                <TooltipTrigger
                  ><Avatar>
                    <AvatarImage v-if="user.image" :src="user?.image" :alt="user.username" />
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
