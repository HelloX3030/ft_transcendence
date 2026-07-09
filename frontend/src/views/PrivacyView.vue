<script setup lang="ts">
import privacyRaw from '@/assets/legal/privacy-policy.md?raw';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();
const content = md.render(privacyRaw);
</script>

<template>
  <div class="mx-auto max-w-2xl p-6">
    <div class="prose prose-invert max-w-none" v-html="content" />
  </div>
</template>
