import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // No TMDB key here: the backend proxies TMDB, and anything the browser needs
  // has to be VITE_-prefixed, which would publish the key in the bundle.
  const required = ['VITE_APP_NAME', 'VITE_BACKEND_URL', 'BACKEND_URL_DOCKER'];
  for (const key of required) {
    if (!env[key]) throw new Error(`Missing required env var: ${key}`);
  }

  return {
    plugins: [vue(), vueDevTools(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 5173,
      watch: { usePolling: true },
      proxy: {
        '/v1': env.BACKEND_URL_DOCKER,
      },
    },
  };
});
