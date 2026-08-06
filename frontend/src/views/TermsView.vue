<script setup lang="ts">
import termsRaw from '@/assets/legal/terms-of-service.md?raw';
import MarkdownIt from 'markdown-it';
import LegalPage from '@/components/LegalPage.vue';

const md = new MarkdownIt();
const content = md.render(termsRaw);
</script>

<template>
  <LegalPage
    :content="content"
    title="Terms of Service"
    other-title="Privacy Policy"
    other-path="/privacy"
  />
</template>
