import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// Deliberately not `mergeConfig(viteConfig, …)`: vite.config.ts asserts that the
// runtime env vars are present, which they are not (and need not be) in a unit
// test run or in CI. Only the Vue plugin is taken from it, so component specs
// can mount an SFC; those specs opt into a DOM with a
// `// @vitest-environment jsdom` docblock, and everything else stays in node.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
