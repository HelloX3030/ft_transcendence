# Formatting & Linting Pipeline

How the code quality tooling works in TrailerTinder, what runs when, and what every developer needs to do once after cloning.

---

## The three layers

```
Save file  →  Editor formats automatically          (Layer 1 — instant, local)
git commit →  Hook formats staged files              (Layer 2 — local gate)
PR / push  →  CI checks format, lint, types, tests  (Layer 3 — enforced gate)
```

Each layer is independent. If a developer skips Layer 1 (no VS Code), Layer 2 catches it. If they skip Layer 2 (`--no-verify`), Layer 3 catches it before merge.

---

## Layer 1 — Editor (VS Code, format on save)

**What happens:** Every time you save a `.ts`, `.vue`, `.css`, or `.json` file, VS Code runs Prettier to reformat it. ESLint auto-fixes any fixable lint issues on save too.

**Config:** `.vscode/settings.json` at the repo root (committed — applies to everyone):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" }
}
```

**What devs need:** Accept the "Install recommended extensions" prompt that VS Code shows when you open the repo. The extensions are listed in `.vscode/extensions.json`:
- `esbenp.prettier-vscode` — Prettier formatter
- `dbaeumer.vscode-eslint` — ESLint integration
- `Vue.volar` — Vue 3 language support (type-checking in templates)
- `oxc.oxc-vscode` — oxlint fast linter (frontend only)

**Result:** You almost never think about formatting. Code is formatted the moment you save.

---

## Layer 2 — Pre-commit hook (husky + lint-staged)

### What is husky?

Git has a built-in hooks system: scripts placed in `.git/hooks/` that git runs automatically at lifecycle points (`pre-commit`, `commit-msg`, `pre-push`, etc.). The problem is `.git/` is never committed to the repo — so those scripts only exist on your machine. New devs get nothing.

**Husky** (an npm package, name is a git/sled-dog pun) solves this with two ideas:
1. Hook scripts live in `.husky/` — a normal folder that *is* committed and shared
2. It uses npm's `prepare` lifecycle hook to tell git "look in `.husky/` for hooks"

When a dev runs `npm install`, npm automatically runs `prepare`, husky runs, and git is configured to pick up `.husky/pre-commit`. From then on `git commit` executes that script just like a native hook. Husky itself has no other functionality — it's just the bridge between committed files and git's hook system.

**lint-staged** is a separate tool that runs linters only on files that are currently staged (`git add`ed), not the whole repo. This keeps commits fast — reformatting 500 files on every commit would be unbearable.

---

**What happens:** When you run `git commit`, Git fires the `.husky/pre-commit` hook. The hook runs `lint-staged` inside a `node:22` Docker container — **formatting only, no linting**:

- **frontend** `src/**/*.{ts,vue,css,json}` → `prettier --write`
- **backend** `{src,test}/**/*.ts` → `prettier --write`

Staged files are reformatted and re-staged automatically. The hook never blocks a commit — lint errors are only enforced by CI (Layer 3).

**Why Docker?** School machines often run older system Node versions. Running the hook inside Docker guarantees a consistent Node 22 environment regardless of what's installed on the host. The hook also runs `npm install` in each workspace before lint-staged, so it self-heals after a `git pull` that adds new dependencies — no manual reinstall needed.

**What happens if Docker is not running?** The hook prints a warning and exits 0 (commit proceeds). CI on Node 22 is the fallback enforcement gate.

**First use:** Docker pulls `node:22` (~1.1 GB) the first time the hook fires. Subsequent commits use the cached image and are fast.

**Config files:**
- `.husky/pre-commit` — the hook script (runs lint-staged in Node 22 via Docker)
- `frontend/package.json` → `"lint-staged"` key — prettier for all staged source files
- `backend/package.json` → `"lint-staged"` key — prettier for all staged source files

**What devs need:** Run `npm install` once in the repo root after cloning, and have Docker running when committing:
```bash
# From the repo root (ft_transcendence/):
npm install
```
This installs husky and runs its `prepare` script, which writes the git hook into `.git/hooks/`. Without this step, the hook silently doesn't exist and commits are ungated locally.

The hook can be bypassed intentionally with `git commit --no-verify`, which is sometimes needed (e.g. committing a WIP). That's fine — CI (Layer 3) is the real gate.

---

## Layer 3 — CI (GitHub Actions)

**What happens:** On every push to `main` and every pull request, two parallel jobs run:

**Frontend job** (`working-directory: frontend`):
1. `npm ci` — clean install
2. `npm run format:check` — Prettier format check
3. `npm run lint:check` — oxlint + ESLint
4. `npm run type-check` — TypeScript compiler check

**Backend job** (`working-directory: backend`):
1. `npm ci` — clean install
2. `npx prisma generate` — generates the Prisma client (required before linting, which imports from `@prisma/client`)
3. `npm run format:check` — Prettier format check
4. `npm run lint:check` — ESLint
5. `npm run test` — Jest unit tests

If any step fails, the PR is blocked. E2e tests are excluded from CI because they need the full Docker stack.

> **Note:** The root `npm run check` command is the local equivalent of both CI jobs combined — it runs frontend check + backend check + backend unit tests, all via Docker. Run it before pushing to catch everything CI will catch.

**Config:** `.github/workflows/ci.yml`

---

## Prettier and ESLint — how they relate

These two tools have different jobs and are wired to not conflict:

| Tool | Job | What it touches |
|---|---|---|
| **Prettier** | Formatting only — whitespace, quotes, line breaks | All files |
| **ESLint** | Code correctness — bugs, type errors, unused vars | `.ts`, `.vue` |
| **oxlint** | Fast subset of ESLint rules (frontend only) | `.ts`, `.vue` |
| **eslint-config-prettier** | Turns off ESLint's formatting rules so they don't fight Prettier | Built into both configs |
| **eslint-plugin-oxlint** | Turns off ESLint rules that oxlint already handles | Frontend ESLint config |

**Rule:** Prettier owns all formatting decisions. Never configure ESLint to enforce formatting rules — that's what `eslint-config-prettier` prevents.

---

## Config file map

```
ft_transcendence/
├── .prettierrc              Shared Prettier rules (singleQuote, trailingComma, endOfLine, printWidth)
├── .gitattributes           Forces LF line endings in git (matches Prettier's endOfLine: lf)
├── .husky/
│   └── pre-commit           Runs lint-staged in frontend/ and backend/ on commit
├── .github/workflows/
│   └── ci.yml               Format check + lint + type-check + tests on every PR
├── frontend/
│   ├── eslint.config.mjs    Vue 3 + TypeScript + oxlint + prettier rules
│   └── package.json         lint-staged + format / format:check / lint / check scripts
└── backend/
    ├── eslint.config.mjs    NestJS + TypeScript + prettier rules
    └── package.json         lint-staged + format / format:check / lint / check scripts
```

---

## Running manually

Root-level commands run via Docker — no local Node version requirement:

```bash
# Full check suite (format + lint + type-check + tests) — identical to CI:
npm run check

# Auto-fix formatting + lint issues:
npm run fix

# Backend unit tests only:
npm run test
```

Sub-directory commands run directly and require **Node >=22.12.0** on the host:

```bash
# Frontend only:
cd frontend && npm run check         # format:check + lint:check (oxlint + ESLint) + type-check
cd frontend && npm run fix           # auto-fix formatting + lint
cd frontend && npm run format:check  # Prettier check only

# Backend only:
cd backend && npm run check          # format:check + lint:check (no tests)
cd backend && npm run fix            # auto-fix formatting + lint
cd backend && npm run format:check   # Prettier check only
cd backend && npm run test           # Jest unit tests
```

---

## First-time setup checklist (for every developer)

1. Clone the repo
2. `npm install` in the repo root — activates git hooks
3. `docker compose up --build` — starts the stack; node modules are installed automatically inside the containers on first start
4. Open the repo in VS Code — accept "Install recommended extensions" prompt
5. Done. Format on save and pre-commit hooks are now active.

The root `npm install` in step 2 must be run on the host machine — that's what wires up the git hook. The containers manage their own `node_modules` inside Docker volumes; the host never needs them for the app to run.

**Optional — editor IntelliSense:** Run `npm install` in `frontend/` and `backend/` on the host so VS Code can resolve types locally. Not required for the app to run.
