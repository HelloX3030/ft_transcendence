<script setup lang="ts">
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
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
  otpValue: string;
  disableError: boolean;
}>();

defineEmits<{
  'update:open': [value: boolean];
  'update:otpValue': [value: string];
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
          less secure. Enter a current code from your authenticator app to confirm.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col items-center gap-4 py-2">
        <InputOTP
          :model-value="otpValue"
          :maxlength="6"
          @update:model-value="$emit('update:otpValue', $event)"
          @complete="$emit('confirm')"
        >
          <InputOTPGroup>
            <InputOTPSlot v-for="i in 6" :key="i" :index="i - 1" />
          </InputOTPGroup>
        </InputOTP>

        <p v-if="disableError" class="text-destructive text-sm">Invalid code. Please try again.</p>

        <!-- There are no recovery codes yet, so losing the authenticator while 2FA
             is on leaves no way back into the account. Saying so is free. -->
        <p class="text-muted-foreground text-xs text-center max-w-xs">
          You need your authenticator app to turn 2FA off. If you lose access to it, you will not be
          able to recover this account.
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">Cancel</Button>
        <Button
          variant="destructive"
          :disabled="otpValue.length !== 6 || isDisabling"
          @click="$emit('confirm')"
        >
          {{ isDisabling ? 'Disabling...' : 'Disable 2FA' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
