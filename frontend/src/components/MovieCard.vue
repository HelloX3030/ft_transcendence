<script setup lang="ts">
import { computed } from 'vue';
import { CircleCheck } from '@lucide/vue';
import { AspectRatio } from './ui/aspect-ratio';
import { Skeleton } from './ui/skeleton';

interface Props {
  title: string;
  img: string | null;
  selected?: boolean;
  loading?: boolean;
  /** `sm` shrinks the chrome only, the poster keeps its 2:3 ratio at every size. */
  size?: 'default' | 'sm';
}

const props = withDefaults(defineProps<Props>(), { size: 'default' });

// Whole class strings rather than a radius spliced into fragments: Tailwind's
// scanner only emits CSS for classes it can read verbatim in the source. Keeping
// each size's five corner-carrying strings in one object is also what stops the
// wrapper, the hover layer, the image, the fallback and the title strip drifting
// to different radii.
const SIZES = {
  default: {
    frame: 'rounded-2xl overflow-hidden',
    hover:
      'hover:ring-2 hover:ring-primary absolute inset-0 rounded-2xl hover:cursor-pointer transition-all duration-300 ease-in-out ',
    check: 'absolute right-4 top-4 text-primary z-10',
    image: 'rounded-2xl w-full h-full object-cover',
    fallback: 'rounded-2xl w-full h-full bg-muted',
    caption: 'bg-black/50 absolute bottom-0 w-full p-4 rounded-b-2xl',
    title: 'text-sm truncate',
  },
  sm: {
    frame: 'rounded-lg overflow-hidden',
    hover:
      'hover:ring-2 hover:ring-primary absolute inset-0 rounded-lg hover:cursor-pointer transition-all duration-300 ease-in-out',
    check: 'absolute right-2 top-2 size-4 text-primary z-10',
    image: 'rounded-lg w-full h-full object-cover',
    fallback: 'rounded-lg w-full h-full bg-muted',
    caption: 'bg-black/50 absolute bottom-0 w-full px-2 py-1.5 rounded-b-lg',
    title: 'text-xs truncate',
  },
} as const;

const style = computed(() => SIZES[props.size]);
</script>

<template>
  <AspectRatio :ratio="2 / 3" :class="style.frame">
    <!-- Skeleton -->
    <template v-if="loading">
      <Skeleton class="absolute inset-0" />
    </template>

    <!-- Movie -->
    <template v-else>
      <div :class="[selected ? 'ring-2 ring-primary' : '', style.hover]" @click="$emit('select')">
        <CircleCheck :class="style.check" v-if="selected" />
        <img
          v-if="img"
          :src="`https://image.tmdb.org/t/p/w500/${img}`"
          :alt="title"
          :class="style.image"
          loading="lazy"
        />
        <div v-else :class="style.fallback"></div>
        <div :class="style.caption">
          <p :class="style.title">{{ title }}</p>
        </div>
      </div>
    </template>
  </AspectRatio>
</template>
