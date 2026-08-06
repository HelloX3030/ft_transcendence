<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowLeft } from '@lucide/vue';
import { APP_NAME } from '@/lib/constants';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
  /** Rendered HTML of the legal document. */
  content: string;
  title: string;
  /** The other legal page, so an evaluator can reach both from either one. */
  otherTitle: string;
  otherPath: string;
}>();

const auth = useAuthStore();

// router.back() is wrong here: these pages are reachable by typing the URL, and
// then there is no history entry to go back to.
const backPath = computed(() => (auth.isLoggedIn ? '/' : '/login'));
</script>

<template>
  <div class="h-full overflow-y-auto">
    <header class="mx-auto flex max-w-2xl items-center justify-between gap-4 p-6 pb-0">
      <RouterLink to="/" class="text-lg font-semibold">{{ APP_NAME }}</RouterLink>
      <RouterLink
        :to="backPath"
        class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
      >
        <ArrowLeft class="size-4" />
        Back
      </RouterLink>
    </header>

    <main class="mx-auto max-w-2xl p-6">
      <!-- The input is a markdown file compiled into the bundle with ?raw, never
           user content, so there is nothing here to sanitise. -->
      <div class="prose prose-invert max-w-none" v-html="props.content" />
    </main>

    <footer class="text-muted-foreground mx-auto max-w-2xl p-6 pt-0 text-sm">
      <RouterLink :to="props.otherPath" class="hover:underline">
        {{ props.otherTitle }}
      </RouterLink>
    </footer>
  </div>
</template>
