<script setup lang="ts">
import { useTotp } from '@/composables/useTopt';
import { ShieldCheck, ShieldOff } from '@lucide/vue';
import TotpSetupDialog from './TotpSetupDialog.vue';
import TotpDisableDialog from './TotpDisableDialog.vue';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card/index.ts';
import { Button } from '../ui/button/index.ts';

defineProps<{ totpActive: boolean }>();

const {
  isSetupDialogOpen,
  otpValue,
  isVerifying,
  verifyError,
  isLoadingQrCode,
  qrCodeSvg,
  qrLoadError,
  isDisableDialogOpen,
  isDisabling,
  verifyOtp,
  downloadQrCode,
  disableTotp,
  handle2faButtonClick,
} = useTotp();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-muted-foreground text-sm font-medium">
        Two-Factor Authentication
      </CardTitle>
    </CardHeader>
    <CardContent class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <component
          :is="totpActive ? ShieldCheck : ShieldOff"
          class="size-5 shrink-0"
          :class="totpActive ? 'text-primary' : 'text-muted-foreground'"
        />
        <div class="flex flex-col min-w-0">
          <span class="text-sm font-medium">{{ totpActive ? 'Enabled' : 'Disabled' }}</span>
          <span class="text-muted-foreground text-xs">
            {{
              totpActive
                ? 'Your account is protected with an authenticator app.'
                : 'Add an extra layer of security to your account.'
            }}
          </span>
        </div>
      </div>
      <Button
        :variant="totpActive ? 'destructive' : 'default'"
        class="shrink-0"
        @click="handle2faButtonClick(totpActive)"
      >
        {{ totpActive ? 'Disable' : 'Enable' }} 2FA
      </Button>
    </CardContent>
  </Card>

  <TotpSetupDialog
    v-model:open="isSetupDialogOpen"
    :otp-value="otpValue"
    :is-verifying="isVerifying"
    :verify-error="verifyError"
    :is-loading-qr-code="isLoadingQrCode"
    :qr-code-svg="qrCodeSvg"
    :qr-load-error="qrLoadError"
    @update:otp-value="otpValue = $event"
    @verify="verifyOtp"
    @download="downloadQrCode"
  />

  <TotpDisableDialog
    v-model:open="isDisableDialogOpen"
    :is-disabling="isDisabling"
    @confirm="disableTotp"
  />
</template>
