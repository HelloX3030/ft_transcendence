# TrailerTinder

> Discover movies through short trailers — swipe, like, and watch together.

TrailerTinder is a mobile-first web app where users swipe through film trailers TikTok-style to find movies they want to watch. A recommendation engine learns from your behavior, and the Movie Night Mode lets you and friends swipe simultaneously to find a film everyone agrees on.

---

## Documentation

- [Architecture & Tech Decisions](_meta/doc/ARCHITECTURE.md)
- [Implementation Roadmap](_meta/doc/ROADMAP.md)
- [Google Sign-In setup](#google-sign-in-optional) — optional; the app runs without it
- `https://localhost:8443/api/docs` Interactive docs with all endpoints, inputs, and responses: 

---

## Setup

**1. Create the config file** (first time only):

```bash
cp .env.example .env
```

Edit `.env` to set real passwords if desired.

To create a new MFA_KEY, run the following command.
`openssl rand -hex 32`

The Google keys in `.env` are optional — see [Google Sign-In](#google-sign-in-optional) below.

**2. Install local dependencies** (first time only):

```bash
npm run setup
```

This does three things in one step:
- Installs Husky at the repo root and wires up the pre-commit hook
- Installs `node_modules` locally in `frontend/` and `backend/` so your IDE (VS Code, WebStorm, etc.) gets full IntelliSense

> **Engine warnings are expected** if your local Node is older than 20.19.0 — the install still completes successfully. All tools (`fix`, `check`, `test`) run inside Docker so your host Node version doesn't matter.

The hook runs lint-staged inside a `node:22` Docker container so it works regardless of your host Node version. **Docker must be running when you commit** — on first use it pulls the image (~1.1 GB, cached after that). If Docker is not running the hook skips with a warning and CI verifies instead.

> **Note:** The local `node_modules` are only for the IDE — the app always runs inside Docker using isolated named volumes. Never use the local `node_modules` to run the app or tests.

**3. Start the stack:**

```bash
docker compose up --build
```

| Service     | URL                   |
| ----------- | --------------------- |
| App         | https://localhost:8443     |
| Backend API | https://localhost:8443/api |
| Swagger     | https://localhost:8443/api/docs |
| pgAdmin     | http://localhost:5050      |
| PostgreSQL  | localhost:5432             |

> **Expect one certificate warning.** The app is served over HTTPS with a self-signed certificate that Caddy generates itself, so the first visit to `https://localhost:8443` shows *"your connection is not private"*. Accept it once — this is expected, not a defect. A real CA would need either a public domain or a certificate authority installed into the machine's trust store, neither of which belongs in a project you clone and run.
>
> Everything the browser talks to is behind `https://localhost:8443`. Ports `5173`, `3000` and `9000` are deliberately not published — if they were reachable, the plain-HTTP path would still exist. pgAdmin (`5050`), Postgres (`5432`) and the MinIO console (`9001`) stay exposed on purpose: they are developer tools, not part of the web application.
>
> **Why `:8443` and not `:443`?** The school machines run rootless Docker, which refuses to publish ports below 1024 — on `443` the stack fails to start at all. `8443` needs no host configuration and behaves identically.

`http://localhost:8080` redirects to HTTPS.

On subsequent runs `--build` can be omitted — node modules live in named Docker volumes and are installed automatically on first container start.

**Adding a package:**

Always install from inside the running container. This updates `package.json` and `package-lock.json` on the host (via the bind-mount) and installs into the container's named volume:

```bash
docker compose exec frontend sh -c "npm install <package>"
docker compose exec backend  sh -c "npm install <package>"
```

The container keeps running — no restart needed. Then sync your local IDE node_modules:

```bash
cd frontend && npm install   # or backend/
```

**Full reset** (e.g. after a merge conflict in the lock file):

```bash
docker compose down -v && docker compose up
```

**VS Code:** Open the repo and accept the "Install recommended extensions" prompt — this sets up Prettier (format on save) and ESLint automatically.

**4. Run Prisma Setup:**

```bash
docker compose exec backend  sh -c "npx prisma migrate dev"
```

`npx prisma migrate dev`: Applies database migrations in development, creating or updating your database schema to match your Prisma schema.

---

## Google Sign-In (optional)

**The app runs fine without this.** Leave the Google keys in `.env` empty and everything else works exactly as documented — the stack boots, and the "Continue with Google" button is simply hidden. A missing button is the expected state, not a failure.

Google sign-in needs OAuth credentials that cannot be committed to a repository, so each person who wants to exercise it creates their own. It takes about five minutes.

**1. Create a Google Cloud project**

Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project. Any Google account works — a personal one is fine.

**2. Configure the OAuth consent screen**

Under *APIs & Services → OAuth consent screen*:

- User type: **External**
- Fill in the app name and the required contact emails
- Leave the publishing status on **Testing** — no verification review is needed

**3. Add yourself as a test user**

Still on the consent screen, under **Test users**, add every Google account you intend to log in with (up to 100).

> **Do not skip this.** An account that is not on the list is refused at Google's own consent screen with *"app has not completed the Google verification process"*. It looks like a bug in this app, but nothing here is involved — the request never reaches us.

**4. Create the OAuth client**

Under *APIs & Services → Credentials → Create credentials → OAuth client ID*:

- Application type: **Web application**
- Under **Authorized redirect URIs**, add exactly:

  ```
  https://localhost:8443/api/v1/auth/google/callback
  ```

Google compares this string character for character against what the backend sends, so it has to match `GOOGLE_CALLBACK_URL` in `.env` precisely — no trailing slash, no `http`, no different port.

**5. Fill in `.env`**

Copy the client ID and secret from the console:

```bash
GOOGLE_CLIENT_ID=<from the console>
GOOGLE_CLIENT_SECRET=<from the console>
GOOGLE_CALLBACK_URL=https://localhost:8443/api/v1/auth/google/callback
GOOGLE_ENABLED=true
```

`GOOGLE_ENABLED` is what reveals the button in the frontend; set it only once the three values above are filled in. Then restart the stack so both containers pick up the new environment:

```bash
docker compose up -d --force-recreate frontend backend
```

**Troubleshooting**

| What you see | Cause |
|---|---|
| `redirect_uri_mismatch` at Google | The Authorized redirect URI in the console and `GOOGLE_CALLBACK_URL` differ. Compare them character by character. |
| "Access blocked" / "has not completed verification" | The Google account you are signing in with is not on the **Test users** list (step 3). |
| No "Continue with Google" button | `GOOGLE_ENABLED` is not `true`, or the frontend container was not restarted after the change. |
| `503` from `/api/v1/auth/google` | The backend has no credentials — one of the three `GOOGLE_*` values is empty, or the backend was not restarted. |
| Signed in at Google, then bounced back to login | The session cookie did not survive the redirect. Check that you reached the app over `https://localhost:8443` and not some other host or port. |

---

## Testing

**Unit tests** (no DB required):

```bash
npm run test                         # via Docker from the project root
docker compose exec backend npm test # inside the running container
```

**E2e tests** (DB must be running):

```bash
docker compose exec backend npm run test:e2e
```

Test files: `backend/src/**/*.spec.ts` (unit) · `backend/test/**/*.e2e-spec.ts` (e2e)

---

## Code Quality

Three commands cover everything, run from the project root via Docker (no local Node version required):

```bash
npm run fix    # auto-fix formatting + lint issues
npm run check  # read-only validation: format + lint + type-check + tests — identical to CI
npm run test   # backend unit tests only
```

The pre-commit hook covers only staged files; `npm run check` runs all files.
