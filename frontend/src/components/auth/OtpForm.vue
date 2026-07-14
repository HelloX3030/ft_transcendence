<script setup lang="ts">
import { ref } from 'vue';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { Button } from '../ui/button/index.ts';

defineProps<{ error: string | null; loading: boolean }>();
const emit = defineEmits<{ verify: [otp: string]; back: [] }>();

const otpValue = ref('');
</script>

<template>
  <div class="space-y-6">
    <p class="text-muted-foreground text-sm text-center">
      Enter the 6-digit code from your authenticator app.
    </p>
    <div class="flex justify-center">
      <InputOTP v-model="otpValue" :maxlength="6" @complete="emit('verify', otpValue)">
        <InputOTPGroup>
          <InputOTPSlot v-for="i in 6" :key="i" :index="i - 1" />
        </InputOTPGroup>
      </InputOTP>
    </div>

    <p v-if="error" class="text-sm text-destructive text-center">{{ error }}</p>

    <Button
      class="w-full"
      :disabled="otpValue.length !== 6 || loading"
      @click="emit('verify', otpValue)"
    >
      {{ loading ? 'Verifying...' : 'Verify' }}
    </Button>
    <Button variant="link" class="w-full" @click="emit('back')">Back to login</Button>
  </div>
</template>
