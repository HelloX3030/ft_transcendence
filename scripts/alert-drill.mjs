/**
 * Breaks something on purpose, waits for the alert to fire, shows the mail it
 * produced, and puts it back.
 *
 * Alerting is the one part of the monitoring stack that cannot be verified by
 * looking at it — a dashboard is either drawing or it is not, but a rule that
 * never fires and a rule that is broken look identical. This runs the whole
 * chain end to end: condition, `for` window, Alertmanager, SMTP, inbox.
 *
 * Usage:
 *   npm run metrics:drill                # redis, the default
 *   npm run metrics:drill -- target      # an exporter, zero user impact
 *   npm run metrics:drill -- recommender
 *   npm run metrics:drill -- postgres
 *
 * The service is always restarted, including when the script fails or is
 * interrupted — see the finally block and the signal handlers at the bottom.
 *
 * Exit code is 0 only if the alert reached `firing` AND a mail arrived.
 */
import { execFileSync } from 'node:child_process';

/** Repo root, so the script works from any cwd. */
const ROOT = new URL('..', import.meta.url).pathname;

/**
 * What each drill breaks, and what should happen.
 *
 * `redis` is the default because the application is built to survive it: cache
 * reads become misses and every request still succeeds, so the drill costs
 * nothing but a cold cache. `target` is gentler still — stopping an exporter
 * removes an observer, not a dependency, so nothing user-facing changes at all.
 */
const SCENARIOS = {
  redis: {
    service: 'redis',
    alert: 'RedisDown',
    why:
      'The exporter keeps answering scrapes and reports redis_up 0, so this is\n' +
      '  the case `up == 0` would miss entirely. The app degrades rather than\n' +
      '  fails: cache reads turn into misses and go upstream to TMDB.',
  },
  target: {
    service: 'redis_exporter',
    alert: 'TargetDown',
    why:
      'Stopping an exporter removes an observer, not a dependency — nothing\n' +
      '  user-facing changes. Prometheus notices because the scrape itself fails.',
  },
  recommender: {
    service: 'recommender',
    alert: 'TargetDown',
    why:
      'The recommendation service. The feed falls back rather than erroring,\n' +
      '  so without this alert the degradation is invisible.',
  },
  postgres: {
    service: 'db',
    alert: 'PostgresDown',
    why:
      'The heaviest drill: the backend will log connection errors while this\n' +
      '  runs and recover when the database returns. Like the redis case, the\n' +
      '  exporter stays up and reports pg_up 0, so `up == 0` never triggers.',
  },
};

const PROM = 'http://localhost:9090';
const MAILPIT = 'http://localhost:8025';
/** Every rule this drill can trigger uses `for: 2m`; allow for scrape lag on top. */
const FIRE_TIMEOUT_MS = 240_000;
/** Alertmanager holds a new group for group_wait (30s) before it notifies. */
const MAIL_TIMEOUT_MS = 120_000;
const POLL_MS = 3_000;

const compose = (args, opts = {}) =>
  execFileSync('docker', ['compose', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });

const inPrometheus = (args) => {
  try {
    return compose(['exec', '-T', 'prometheus', ...args]);
  } catch {
    return null;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clock = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const since = (start) => `${Math.round((Date.now() - start) / 1000)}s`;

/** The state Prometheus reports for one alert rule: inactive, pending or firing. */
function alertState(name) {
  const raw = inPrometheus(['wget', '-qO-', `${PROM}/api/v1/rules?type=alert`]);
  if (raw === null) return null;
  for (const group of JSON.parse(raw).data.groups) {
    for (const rule of group.rules) {
      if (rule.name === name) return rule.state;
    }
  }
  return null;
}

/** Mailpit is the one published piece of this chain, so it is read over HTTP. */
async function inbox() {
  try {
    const res = await fetch(`${MAILPIT}/api/v1/messages?limit=50`);
    return (await res.json()).messages ?? [];
  } catch {
    return null;
  }
}

/**
 * The mail this drill caused, and no other.
 *
 * Matching on "a new message appeared" is not enough: Alertmanager sends a
 * [RESOLVED] mail for an earlier alert on its own schedule, and a drill running
 * at the wrong moment would happily report someone else's notification as its
 * own result. The subject has to name this alert and say FIRING, and the message
 * has to be one that was not already in the box when the drill started.
 */
async function findFiringMail(alertName, seenIds) {
  const messages = await inbox();
  if (messages === null) return null;
  return (
    messages.find(
      (m) => !seenIds.has(m.ID) && m.Subject.includes(alertName) && m.Subject.includes('FIRING'),
    ) ?? null
  );
}

async function readMail(id) {
  const full = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
  return { subject: full.Subject, body: full.Text ?? '' };
}

/** Polls until `check()` returns true, or gives up. */
async function waitFor(label, check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await sleep(POLL_MS);
  }
  console.error(`  timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${label}`);
  return false;
}

const name = process.argv[2] ?? 'redis';
const scenario = SCENARIOS[name];
if (!scenario) {
  console.error(`Unknown drill "${name}". Available: ${Object.keys(SCENARIOS).join(', ')}`);
  process.exit(1);
}

if (inPrometheus(['wget', '-q', '--spider', `${PROM}/-/healthy`]) === null) {
  console.error('Prometheus is not reachable. Is the stack up? (docker compose up -d)');
  process.exit(1);
}
if ((await inbox()) === null) {
  console.error(`Mailpit is not reachable at ${MAILPIT}. Is the stack up?`);
  process.exit(1);
}

let stopped = false;

/** Always put it back, whatever happened — including on Ctrl-C. */
function restore() {
  if (!stopped) return;
  stopped = false;
  process.stdout.write(`\n  restarting ${scenario.service} ... `);
  try {
    compose(['start', scenario.service]);
    console.log('done');
  } catch {
    console.log('FAILED');
    console.error(`  Restart it by hand: docker compose start ${scenario.service}`);
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    restore();
    process.exit(130);
  });
}

let ok = false;
const started = Date.now();

try {
  console.log(`Alert drill: ${name}`);
  console.log(`  stopping   ${scenario.service}`);
  console.log(`  expecting  ${scenario.alert}`);
  console.log(`  ${scenario.why}\n`);

  // Every message already in the box, so a notification left over from an
  // earlier drill can never be mistaken for this one's.
  const seenIds = new Set((await inbox()).map((m) => m.ID));

  compose(['stop', scenario.service]);
  stopped = true;
  console.log(`  ${clock()}  stopped ${scenario.service}`);

  // Pending first. This is the state Alertmanager never sees, and the reason a
  // restart does not page anyone: the condition is true but the `for` window has
  // not elapsed, so nothing has been sent.
  const pending = await waitFor(
    'the alert to go pending',
    () => ['pending', 'firing'].includes(alertState(scenario.alert)),
    FIRE_TIMEOUT_MS,
  );
  if (!pending) throw new Error('alert never left inactive');
  console.log(`  ${clock()}  ${scenario.alert} is PENDING (+${since(started)})`);

  const firing = await waitFor(
    'the alert to fire',
    () => alertState(scenario.alert) === 'firing',
    FIRE_TIMEOUT_MS,
  );
  if (!firing) throw new Error('alert never reached firing');
  console.log(`  ${clock()}  ${scenario.alert} is FIRING (+${since(started)})`);

  let found = null;
  const mailed = await waitFor(
    `a [FIRING] mail naming ${scenario.alert}`,
    async () => (found = await findFiringMail(scenario.alert, seenIds)) !== null,
    MAIL_TIMEOUT_MS,
  );
  if (!mailed) throw new Error(`the alert fired but no mail naming ${scenario.alert} arrived`);
  console.log(`  ${clock()}  mail delivered (+${since(started)})\n`);

  const mail = await readMail(found.ID);
  console.log(`  Subject: ${mail.subject}`);
  for (const line of mail.body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8)) {
    console.log(`    ${line}`);
  }
  console.log(`\n  Read it at ${MAILPIT}`);
  ok = true;
} catch (error) {
  console.error(`\n  drill failed: ${error.message}`);
} finally {
  restore();
}

if (ok) {
  // Resolution is not waited for: Alertmanager sends the "resolved" mail on the
  // next group flush, up to group_interval (5m) later, and holding the terminal
  // for it teaches nothing the firing path did not already prove.
  console.log('\n  The alert will clear within a scrape or two, and Alertmanager');
  console.log('  will send a [RESOLVED] mail at its next group flush.');
  console.log('  Watch it with: npm run metrics:alerts');
}
process.exit(ok ? 0 : 1);
