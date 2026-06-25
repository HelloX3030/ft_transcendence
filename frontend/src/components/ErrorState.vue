<script setup lang="ts">
import { CircleAlert, RotateCcw } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';

withDefaults(defineProps<{ message?: string }>(), {
  message: 'Something went wrong.',
});

defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="flex flex-col items-center gap-3 py-8 text-center">
    <CircleAlert class="size-8 text-muted-foreground" />
    <p class="text-sm text-muted-foreground">{{ message }}</p>
    <Button variant="outline" size="sm" @click="$emit('retry')">
      <RotateCcw />
      Try again
    </Button>
  </div>
</template>
