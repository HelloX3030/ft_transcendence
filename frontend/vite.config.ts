import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // No TMDB key here: the backend proxies TMDB, and anything the browser needs
  // has to be VITE_-prefixed, which would publish the key in the bundle.
  const required = ['VITE_BACKEND_URL'];
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
      // Bind 0.0.0.0 so Caddy can reach us; :5173 is not published to the host.
      host: true,
      port: 5173,
      watch: { usePolling: true },
      // The dev server sits behind Caddy, which is the only thing that can
      // reach it — but Vite checks the forwarded Host, so every name Caddy
      // answers to has to be listed here too. Keep the loopback names: APP_HOST
      // adds a host, it does not replace one.
      allowedHosts: ['localhost', '127.0.0.1', env.APP_HOST].filter(Boolean),
      // The HMR client connects from the browser, which only ever sees Caddy.
      // Left at its defaults it would try ws://localhost:5173 — a port that no
      // longer exists — and hot reload would silently die behind a mixed-content
      // warning. No `proxy` block: Caddy owns the routing now.
      hmr: { clientPort: 8443, protocol: 'wss' },
    },
  };
});
