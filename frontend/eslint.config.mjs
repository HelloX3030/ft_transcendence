import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginOxlint from 'eslint-plugin-oxlint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default defineConfigWithVueTs(
  { ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'] },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  pluginOxlint.configs['flat/recommended'],
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ['./tsconfig.json', './tsconfig.app.json', './tsconfig.node.json'],
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
);
