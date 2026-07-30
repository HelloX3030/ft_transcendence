import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Deliberately not `mergeConfig(viteConfig, …)`: vite.config.ts asserts that the
// runtime env vars are present, which they are not (and need not be) in a unit
// test run or in CI.
export default defineConfig({
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
