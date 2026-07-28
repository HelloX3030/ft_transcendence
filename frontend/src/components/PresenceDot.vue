<script setup lang="ts">
interface Props {
  online: boolean;
  /**
   * Pins the dot to the bottom-right corner of the nearest positioned ancestor,
   * for badging an avatar. The parent has to be `relative`.
   */
  overlay?: boolean;
}

withDefaults(defineProps<Props>(), { overlay: false });
</script>

<template>
  <span
    role="img"
    :aria-label="online ? 'Online' : 'Offline'"
    :title="online ? 'Online' : 'Offline'"
    class="block shrink-0 rounded-full border-2 border-background"
    :class="[
      online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
      overlay ? 'absolute bottom-0 right-0 size-3' : 'size-2.5',
    ]"
  />
</template>
