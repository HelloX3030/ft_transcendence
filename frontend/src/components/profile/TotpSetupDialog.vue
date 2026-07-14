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
  otpValue: string;
  isVerifying: boolean;
  verifyError: boolean;
  isLoadingQrCode: boolean;
  qrCodeSvg: string;
  qrLoadError: boolean;
}>();

defineEmits<{
  'update:open': [value: boolean];
  'update:otpValue': [value: string];
  verify: [];
  download: [];
}>();
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
        <DialogDescription>
          Scan the QR code with your authenticator app, then enter the 6-digit code it generates.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col items-center gap-4 py-2">
        <div class="flex size-40 items-center justify-center">
          <p v-if="isLoadingQrCode" class="text-muted-foreground text-xs">Loading QR code...</p>
          <div v-else-if="qrCodeSvg" v-html="qrCodeSvg" class="size-40 [&_svg]:size-full" />
          <p v-else-if="qrLoadError" class="text-destructive text-xs">Failed to load QR code.</p>
        </div>

        <Button
          v-if="qrCodeSvg"
          type="button"
          variant="outline"
          size="sm"
          @click="$emit('download')"
        >
          Download QR Code
        </Button>

        <p class="text-muted-foreground text-xs text-center max-w-xs">
          Save or print this QR code and keep it somewhere safe. Without it and access to your
          authenticator app, you won't be able to log in if you lose your device.
        </p>

        <InputOTP
          :model-value="otpValue"
          :maxlength="6"
          @update:model-value="$emit('update:otpValue', $event)"
          @complete="$emit('verify')"
        >
          <InputOTPGroup>
            <InputOTPSlot v-for="i in 6" :key="i" :index="i - 1" />
          </InputOTPGroup>
        </InputOTP>

        <p v-if="verifyError" class="text-destructive text-sm">Invalid code. Please try again.</p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">Cancel</Button>
        <Button :disabled="otpValue.length !== 6 || isVerifying" @click="$emit('verify')">
          {{ isVerifying ? 'Verifying...' : 'Verify' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
