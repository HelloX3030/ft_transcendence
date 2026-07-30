<script setup lang="ts">
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

defineProps<{
  open: boolean;
  isDeleting: boolean;
}>();

defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
}>();
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Remove your profile photo?</DialogTitle>
        <DialogDescription>
          The photo is deleted from storage and cannot be recovered. Your profile falls back to your
          initials.
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">Cancel</Button>
        <Button variant="destructive" :disabled="isDeleting" @click="$emit('confirm')">
          {{ isDeleting ? 'Removing...' : 'Remove photo' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
