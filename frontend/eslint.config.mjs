import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginOxlint from 'eslint-plugin-oxlint';
import pluginVitest from '@vitest/eslint-plugin';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default defineConfigWithVueTs(
  { ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'] },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  { ...pluginVitest.configs.recommended, files: ['src/**/*.spec.ts'] },
  pluginOxlint.configs['flat/recommended'],
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  // src/api owns the base URL, the credentials mode, the 401-refresh-retry and
  // the envelope unwrap. A bare fetch elsewhere gets none of them — which is how
  // a profile page shipped pointing at the Vue dev server instead of the API.
  {
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/api/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Use backendClient / uploadWithProgress from @/api — they own the base URL, the credentials and the 401 refresh.',
        },
      ],
    },
  },
);
