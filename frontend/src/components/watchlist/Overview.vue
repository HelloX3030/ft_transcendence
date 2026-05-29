<script setup lang="ts">
import { Pencil } from '@lucide/vue';
import { Button } from '../ui/button';
import { computed } from 'vue';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface Props {
  title: string;
  posters: { img: string }[];
  description?: string;
  size: number;
  totalSlots?: number;
}

const props = defineProps<Props>();

const slots = computed(() => {
  const total = props.totalSlots ?? 5;

  return Array.from({ length: total }, (_, i) => ({
    img: props.posters[i]?.img ?? null,
  }));
});
</script>

<template>
  <Card class="">
    <CardHeader>
      <CardTitle>{{ title }}</CardTitle>
      <CardDescription>{{ size }} Films</CardDescription>
      <CardAction
        ><TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost"> <Pencil /> </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit List</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider></CardAction
      >
    </CardHeader>
    <CardContent>
      <div class="flex justify-center">
        <div
          v-for="(slot, idx) in slots"
          :key="idx"
          :style="{ zIndex: slots.length - idx }"
          class="w-24 h-36 -mr-8 last:mr-0 overflow-hidden filter-[drop-shadow(4px_0px_4px_rgba(0,0,0,0.4))]"
        >
          <img
            v-if="slot.img"
            :src="`https://image.tmdb.org/t/p/w500/${slot.img}`"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full bg-popover" />
        </div>
      </div>
    </CardContent>
    <!-- <CardFooter> {{ size }} Films </CardFooter> -->
  </Card>
</template>
