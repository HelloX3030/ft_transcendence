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
  isDisabling: boolean;
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
        <DialogTitle>Disable Two-Factor Authentication?</DialogTitle>
        <DialogDescription>
          Your account will no longer require a verification code at login. This makes your account
          less secure.
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">Cancel</Button>
        <Button variant="destructive" :disabled="isDisabling" @click="$emit('confirm')">
          {{ isDisabling ? 'Disabling...' : 'Disable 2FA' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
