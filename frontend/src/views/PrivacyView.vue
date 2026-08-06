<script setup lang="ts">
import privacyRaw from '@/assets/legal/privacy-policy.md?raw';
import MarkdownIt from 'markdown-it';
import LegalPage from '@/components/LegalPage.vue';

const md = new MarkdownIt();
const content = md.render(privacyRaw);
</script>

<template>
  <LegalPage
    :content="content"
    title="Privacy Policy"
    other-title="Terms of Service"
    other-path="/terms"
  />
</template>
