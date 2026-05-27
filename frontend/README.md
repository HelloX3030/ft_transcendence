# TrailerTinder — Frontend

Vue 3 + Vite SPA. Runs on port 5173 inside Docker.

---

## Stack

| | |
|---|---|
| Framework | Vue 3 (Composition API) |
| Language | TypeScript (strict) |
| Bundler | Vite |
| Styling | Tailwind CSS 4 |
| Component library | Reka UI (shadcn-vue pattern) |
| State management | Pinia |
| Routing | Vue Router |
| Icons | Lucide Vue |
| Utilities | VueUse |

---

## Directory layout

```
src/
├── views/           Page-level components (one per route)
├── components/      Reusable feature components
│   └── ui/          Reka UI wrappers — generated via shadcn-vue CLI, do not hand-edit
├── stores/          Pinia stores
├── router/          Vue Router configuration
├── lib/
│   └── utils.ts     Shared utility functions
├── App.vue          Root component
└── main.ts          Bootstrap
```

---

## Running (via Docker Compose)

```bash
docker compose up --build   # Start the full stack (frontend on port 5173)
```

---

## Standalone dev commands

These run directly and require **Node >=22.12.0** on the host. Prefer the root-level `npm run fix` / `npm run check` if your local Node is older — those run via Docker automatically.

```bash
npm install           # Install dependencies

npm run dev     # Hot-reload dev server
npm run build   # Type-check + production build
npm run fix     # Auto-fix formatting + lint issues
npm run check   # Read-only validation (format + lint + type-check)
```

---

## IDE setup

- **VS Code** + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) — disable Vetur if installed
- Browser: [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) (Chrome) · [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/) (Firefox)
