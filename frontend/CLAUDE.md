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

---

## Directory layout

```
src/
├── views/           Page-level components (one per route)
├── components/      Reusable feature components
│   └── ui/          Reka UI wrappers — do not hand-edit these
├── stores/          Pinia stores
├── router/          Vue Router configuration
├── lib/
│   └── utils.ts     Shared utility functions
├── App.vue          Root component
└── main.ts          Bootstrap
```

---

## Conventions

- **Views** (`src/views/`) map 1:1 to routes. Keep them thin — delegate logic to components and stores.
- **Components** (`src/components/`) hold reusable feature UI. Group by feature if the folder grows large.
- **UI primitives** (`src/components/ui/`) are generated via the shadcn-vue CLI and should not be edited by hand. Add new primitives with `npx shadcn-vue@latest add <component>`.
- **State** lives in Pinia stores (`src/stores/`). Do not manage cross-component state with `provide`/`inject` or local refs.

---

## Dev commands

The frontend runs inside Docker — use the root `docker-compose.yml`:

```bash
docker compose up --build   # Start everything (frontend on port 5173)
```

**CI checks (format + lint + type-check, no stack required):**

```bash
cd frontend && npm run check
# or from root:
npm run check
```

---

## Testing

No frontend test infrastructure is set up yet. Do not add test files without first establishing the test runner and configuration.
