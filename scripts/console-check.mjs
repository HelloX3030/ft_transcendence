/**
 * Fails if using the app produces a single console error or warning.
 *
 * Walks transitions rather than routes (token expiry, resume, a second tab, a
 * backend restart) and asserts at each step that nothing reached console.error or
 * console.warn, and that the app still works afterwards.
 *
 * Usage:
 *   docker compose up -d
 *   node scripts/console-check.mjs
 *
 * Requires `playwright` and a Chromium: `npx playwright install chromium`. Judge
 * on a current browser; Chromium 108 invents warnings that Chrome 151 does not.
 */
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const BASE_URL = process.env.CONSOLE_CHECK_URL ?? 'https://localhost:8443';
const API = `${BASE_URL}/api/v1`;
const PASSWORD = 'B8skxi!dk&';

/**
 * The access-token lifetime the stack is running with. The idle stretch has to
 * outlast it or the expiry transition, the whole reason this script exists,
 * is never reached. `.env.example` documents the short values to swap in.
 */
const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TTL_SECONDS ?? 900);

/** Ceiling on the idle wait, so a misconfigured run fails fast instead of hanging. */
const MAX_IDLE_SECONDS = 180;

const problems = [];
const step = (name) => console.log(`\n── ${name}`);
const fail = (where, detail) => problems.push(`${where}: ${detail}`);

/** Anything the browser emits that an evaluator would see as a defect. */
function watchConsole(page, label) {
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      fail(label, `console.${type}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => fail(label, `uncaught: ${error.message}`));
}

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path} → ${response.status}`);
  return response;
}

/** A fresh account, created over the API so the browser only does the walking. */
async function createUser(prefix) {
  const username = `${prefix}-${Date.now().toString(36)}`;
  const email = `${username}@example.com`;
  const response = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password: PASSWORD }),
  });
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const me = await (await api('/users/me', { headers: { cookie } })).json();
  return { username, email, cookie, id: me.data.id };
}

async function signIn(page, user) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

async function main() {
  if (ACCESS_TTL_SECONDS > MAX_IDLE_SECONDS) {
    console.error(
      `ACCESS_TTL_SECONDS is ${ACCESS_TTL_SECONDS}s. Restart the stack with the short\n` +
        `session values documented in .env.example (ACCESS_TTL_SECONDS=30); otherwise\n` +
        `the expiry transition this script exists to cover is never reached.`,
    );
    process.exit(2);
  }

  const [alice, bob] = [await createUser('console-a'), await createUser('console-b')];

  const browser = await chromium.launch();
  // The dev stack serves a self-signed certificate; the warning is the point of
  // accepting it once by hand, not a finding.
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  watchConsole(page, 'tab 1');

  try {
    step('sign in');
    await signIn(page, alice);

    step(`idle across one access-token expiry (${ACCESS_TTL_SECONDS}s + margin)`);
    // No interaction at all: the gateway's expiry sweep has to be what moves
    // things, exactly as it does on a tab left open in the background.
    await page.waitForTimeout((ACCESS_TTL_SECONDS + 70) * 1000);

    step('the connection recovered by itself');
    // Not a log assertion: the socket has to be back, or the notification below
    // could never arrive and a silent console would be hiding a dead app.
    await page.waitForFunction(() => !document.body.innerText.match(/reconnecting|offline/i), {
      timeout: 30_000,
    });

    step('a live notification still arrives after the idle stretch');
    await api(`/friends/${alice.id}`, { method: 'POST', headers: { cookie: bob.cookie } });
    await page.waitForSelector(`text=${bob.username}`, { timeout: 20_000 });

    step('resume and interact');
    await page.goto(`${BASE_URL}/friends`);
    await page.goto(`${BASE_URL}/watchlist`);
    await page.goto(`${BASE_URL}/profile`);

    step('a second tab signs in and out');
    const second = await context.newPage();
    watchConsole(second, 'tab 2');
    await second.goto(`${BASE_URL}/`);
    await second.waitForTimeout(2_000);
    await second.close();

    step('backend restart');
    execFileSync('docker', ['compose', 'restart', 'backend'], { stdio: 'inherit' });
    // Long enough for socket.io to give up, back off and come back, the window
    // where a wrong `connect_error` classification would surface.
    await page.waitForTimeout(45_000);
    await page.waitForFunction(() => !document.body.innerText.match(/offline/i), {
      timeout: 60_000,
    });

    step('sign out');
    await page.goto(`${BASE_URL}/profile`);
    await page.getByRole('button', { name: /log ?out|sign ?out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
  } finally {
    await browser.close();
  }

  if (problems.length > 0) {
    console.error(`\n✗ ${problems.length} console problem(s):`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log('\n✓ no console errors, no warnings, no page errors');
}

await main();
