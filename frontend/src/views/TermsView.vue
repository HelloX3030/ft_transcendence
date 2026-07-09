<script setup lang="ts">
import termsRaw from '@/assets/legal/terms-of-service.md?raw';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();
const content = md.render(termsRaw);
</script>

<template>
  <div class="mx-auto max-w-2xl p-6">
    <div class="prose prose-invert max-w-none" v-html="content" />
  </div>
</template>
