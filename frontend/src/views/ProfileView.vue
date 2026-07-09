<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth';
import { useGenresStore } from '@/stores/genres';
import { usePeopleStore } from '@/stores/people';

import { ref } from 'vue'; // "computed" schon vorhanden, "ref" ergänzen
import { ShieldCheck, ShieldOff } from '@lucide/vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const auth = useAuthStore();
const genres = useGenresStore();
const people = usePeopleStore();
// TODO: durch computed(() => profile.value?.totpActive) ersetzen, sobald Backend
// das Feld in UserMeResponse liefert
const is2faEnabled = ref(false);

// Setup-Dialog (Enable-Flow)
const isSetupDialogOpen = ref(false);
const otpValue = ref('');
const isVerifying = ref(false);
const verifyError = ref(false);
const isLoadingQrCode = ref(false);
const qrCodeSvg = ref('');
const qrLoadError = ref(false);

async function openSetupDialog() {
  otpValue.value = '';
  verifyError.value = false;
  qrLoadError.value = false;
  qrCodeSvg.value = '';
  isSetupDialogOpen.value = true;
  isLoadingQrCode.value = true;
  try {
    qrCodeSvg.value = await auth.setupTotp();
  } catch (err) {
    qrLoadError.value = true;
    console.error(err);
  } finally {
    isLoadingQrCode.value = false;
  }
}

async function handleVerify() {
  if (otpValue.value.length !== 6) return;
  isVerifying.value = true;
  verifyError.value = false;
  try {
    await auth.activateTotp(otpValue.value);
    is2faEnabled.value = true;
    isSetupDialogOpen.value = false;
  } catch {
    verifyError.value = true;
  } finally {
    isVerifying.value = false;
  }
}

// Deaktivieren-Flow
const isDisableDialogOpen = ref(false);
const isDisabling = ref(false);

async function handleDisableConfirm() {
  isDisabling.value = true;
  try {
    await auth.deleteTotp();
    is2faEnabled.value = false;
    isDisableDialogOpen.value = false;
  } catch (err) {
    console.error(err);
    // TODO: Fehler-Toast o.ä. anzeigen
  } finally {
    isDisabling.value = false;
  }
}

function handle2faButtonClick() {
  if (is2faEnabled.value) {
    isDisableDialogOpen.value = true;
  } else {
    void openSetupDialog();
  }
}

const profile = computed(() => auth.user);

const initials = computed(() =>
  profile.value ? profile.value.username.slice(0, 2).toUpperCase() : '??',
);

const languageLabel: Record<string, string> = { de: 'Deutsch', en: 'English', es: 'Español' };

// Map preference id lists to display names, dropping any not yet resolved (the
// catalogue/people cache may still be loading, or an id may be stale).
function resolveNames(ids: number[] | undefined, lookup: (id: number) => string | undefined) {
  return (ids ?? []).map(lookup).filter((name): name is string => name !== undefined);
}

const preferenceSections = computed(() => [
  {
    label: 'Favorite Genres',
    items: resolveNames(profile.value?.genreIds, genres.genreName),
    empty: 'No favorite genres yet',
  },
  {
    label: 'Favorite Directors',
    items: resolveNames(profile.value?.directorIds, people.personName),
    empty: 'No favorite directors yet',
  },
  {
    label: 'Favorite Actors',
    items: resolveNames(profile.value?.actorIds, people.personName),
    empty: 'No favorite actors yet',
  },
]);

// The person ids to resolve, recomputed when the profile loads (it may arrive
// after this view mounts).
const personIds = computed(() => [
  ...(profile.value?.directorIds ?? []),
  ...(profile.value?.actorIds ?? []),
]);

onMounted(() => {
  void genres.ensureLoaded();
});

watch(
  personIds,
  (ids) => {
    if (ids.length) void people.ensureLoaded(ids);
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="mx-auto w-full max-w-2xl md:max-w-none md:w-5/6 flex flex-col gap-6 p-4 sm:p-6 md:p-8"
  >
    <template v-if="profile">
      <Card>
        <CardHeader>
          <div class="flex min-w-0 items-center gap-4">
            <Avatar class="size-20 shrink-0">
              <AvatarImage v-if="profile.image" :src="profile.image" :alt="profile.username" />
              <AvatarFallback class="text-xl font-semibold">{{ initials }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex flex-col gap-1">
              <CardTitle class="break-words text-2xl">{{ profile.username }}</CardTitle>
              <CardDescription>{{ profile.email }}</CardDescription>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 mt-3">
            <span class="text-primary rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
              {{ languageLabel[profile.language] }}
            </span>
            <span
              v-if="profile.role === 'admin'"
              class="text-primary rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium"
            >
              Admin
            </span>
          </div>
        </CardHeader>
        <CardFooter class="justify-end">
          <RouterLink to="/profile/edit">
            <Button variant="outline">Edit Profile</Button>
          </RouterLink>
        </CardFooter>
      </Card>

      <Card v-for="section in preferenceSections" :key="section.label">
        <CardHeader>
          <CardTitle class="text-muted-foreground text-sm font-medium">{{
            section.label
          }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div v-if="section.items.length" class="flex flex-wrap gap-2">
            <span
              v-for="item in section.items"
              :key="item"
              class="text-primary rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium"
            >
              {{ item }}
            </span>
          </div>
          <p v-else class="text-muted-foreground text-sm">{{ section.empty }}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-muted-foreground text-sm font-medium"
            >Two-Factor Authentication</CardTitle
          >
        </CardHeader>
        <CardContent class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <component
              :is="is2faEnabled ? ShieldCheck : ShieldOff"
              class="size-5 shrink-0"
              :class="is2faEnabled ? 'text-primary' : 'text-muted-foreground'"
            />
            <div class="flex flex-col min-w-0">
              <span class="text-sm font-medium">
                {{ is2faEnabled ? 'Enabled' : 'Disabled' }}
              </span>
              <span class="text-muted-foreground text-xs">
                {{
                  is2faEnabled
                    ? 'Your account is protected with an authenticator app.'
                    : 'Add an extra layer of security to your account.'
                }}
              </span>
            </div>
          </div>
          <Button
            :variant="is2faEnabled ? 'destructive' : 'default'"
            class="shrink-0"
            @click="handle2faButtonClick"
          >
            {{ is2faEnabled ? 'Disable' : 'Enable' }} 2FA
          </Button>
        </CardContent>
      </Card>
      <!-- Setup Dialog -->
      <Dialog v-model:open="isSetupDialogOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the 6-digit code it
              generates.
            </DialogDescription>
          </DialogHeader>

          <div class="flex flex-col items-center gap-4 py-2">
            <div class="flex size-40 items-center justify-center">
              <p v-if="isLoadingQrCode" class="text-muted-foreground text-xs">Loading QR code...</p>
              <div v-else-if="qrCodeSvg" v-html="qrCodeSvg" class="size-40 [&_svg]:size-full" />
              <p v-else-if="qrLoadError" class="text-destructive text-xs">
                Failed to load QR code.
              </p>
            </div>

            <InputOTP v-model="otpValue" :maxlength="6" @complete="handleVerify">
              <InputOTPGroup>
                <InputOTPSlot :index="0" />
                <InputOTPSlot :index="1" />
                <InputOTPSlot :index="2" />
                <InputOTPSlot :index="3" />
                <InputOTPSlot :index="4" />
                <InputOTPSlot :index="5" />
              </InputOTPGroup>
            </InputOTP>

            <p v-if="verifyError" class="text-destructive text-sm">
              Invalid code. Please try again.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" @click="isSetupDialogOpen = false">Cancel</Button>
            <Button :disabled="otpValue.length !== 6 || isVerifying" @click="handleVerify">
              {{ isVerifying ? 'Verifying...' : 'Verify' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Disable Confirmation Dialog -->
      <Dialog v-model:open="isDisableDialogOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication?</DialogTitle>
            <DialogDescription>
              Your account will no longer require a verification code at login. This makes your
              account less secure.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" @click="isDisableDialogOpen = false">Cancel</Button>
            <Button variant="destructive" @click="handleDisableConfirm">Disable 2FA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
