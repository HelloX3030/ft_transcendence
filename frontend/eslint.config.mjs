import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginOxlint from 'eslint-plugin-oxlint'
import configPrettier from 'eslint-config-prettier'

export default defineConfigWithVueTs(
  { ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'] },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  pluginOxlint.configs['flat/recommended'],
  configPrettier,
  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
)
