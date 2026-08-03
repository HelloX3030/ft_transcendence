<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { GOOGLE_ENABLED, GOOGLE_LOGIN_URL } from '@/lib/constants';

/**
 * The whole block, separator included, disappears when the server has no Google
 * credentials — leaving a lone "OR" above nothing would look broken.
 *
 * A full page navigation rather than a fetch: the endpoint answers with a
 * redirect to Google's consent screen, and an XHR cannot follow that.
 */
function signIn() {
  window.location.href = GOOGLE_LOGIN_URL;
}
</script>

<template>
  <template v-if="GOOGLE_ENABLED">
    <div class="w-full flex items-center gap-2">
      <Separator class="flex-1" />
      <span class="shrink-0 px-2 text-xs text-muted-foreground uppercase">OR</span>
      <Separator class="flex-1" />
    </div>

    <Button type="button" variant="outline" class="w-full" @click="signIn">
      <img src="/google_icon.svg" alt="" class="size-6" /> Continue with Google
    </Button>
  </template>
</template>
