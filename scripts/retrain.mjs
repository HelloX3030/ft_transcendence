/**
 * Triggers an SVD retrain on the recommender and reports what it actually did.
 *
 * `POST /retrain` answers 202 and runs the fit in a background task, so the
 * response only ever says "scheduled" — the outcome (trained / skipped / failed)
 * reaches the recommender's log a moment later. This script fires the request
 * and then waits for that line, so `npm run retrain` finishes with the result
 * rather than with an acknowledgement.
 *
 * Usage:
 *   docker compose up -d
 *   npm run retrain
 *
 * Exit code is 0 for trained or skipped, 1 for a failed fit or a refused
 * request, so it can gate a cron job or a CI step.
 */
import { execFileSync } from 'node:child_process';

/** Repo root, so the script works from any cwd. */
const ROOT = new URL('..', import.meta.url).pathname;

/**
 * Ceiling on the wait for the outcome line. The fit is synchronous and CPU
 * bound; retrain.py notes it is well under a second at the current data size,
 * so this only matters once the matrix grows.
 */
const TIMEOUT_MS = 120_000;
const POLL_MS = 500;

/**
 * The single line retrain.py logs per attempt. "complete" and "skipped" are the
 * two clean outcomes; the two failure paths log through logger.exception, which
 * prefixes the message with "retrain:".
 */
const OUTCOME = /retrain(?: complete| skipped|: could not read interactions|: SVD fit failed).*/;

const compose = (args) =>
  execFileSync('docker', ['compose', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });

/** Sync pause — every docker call here is synchronous, so the poll loop is too. */
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Posts from inside the container and reads the secret from its environment, so
 * it never passes through this process's argv, the shell history or a log line.
 * python:3.11-slim ships no curl and the interpreter is already there.
 */
const POST = `
import json, os, urllib.error, urllib.request
req = urllib.request.Request(
    "http://localhost:8000/retrain",
    method="POST",
    headers={"x-retrain-secret": os.environ.get("RETRAIN_SECRET", "")},
)
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        print(json.dumps({"code": r.status, "body": json.loads(r.read() or b"{}")}))
except urllib.error.HTTPError as e:
    raw = e.read().decode()
    try:
        body = json.loads(raw)
    except ValueError:
        body = {"detail": raw}
    print(json.dumps({"code": e.code, "body": body}))
except Exception as e:
    print(json.dumps({"code": 0, "body": {"detail": str(e)}}))
`;

function die(message) {
  console.error(`retrain: ${message}`);
  process.exit(1);
}

let response;
try {
  response = JSON.parse(compose(['exec', '-T', 'recommender', 'python', '-c', POST]).trim());
} catch {
  die('could not reach the recommender container. Is the stack up? (docker compose up -d)');
}

const { code, body } = response;

if (code === 401) die('RETRAIN_SECRET does not match the one the container was started with.');
if (code === 503) die(`${body.detail}. Set RETRAIN_SECRET in .env, then: docker compose up -d recommender`);
if (code !== 202) die(`unexpected response ${code}: ${JSON.stringify(body)}`);

if (body.status === 'already_running') {
  console.log('A retrain is already running; not starting a second one.');
  process.exit(0);
}

if (body.previous) {
  const p = body.previous;
  console.log(`Previous run: ${p.status} (${p.interactions} interactions, ${p.duration_seconds}s)`);
}
console.log('Retrain scheduled, waiting for the result…');

// `--since` is relative and recomputed each poll, so the window always covers
// everything since the request went out — no race with the log stream attaching.
const started = Date.now();
while (Date.now() - started < TIMEOUT_MS) {
  sleep(POLL_MS);
  const elapsed = Math.ceil((Date.now() - started) / 1000) + 1;
  const logs = compose(['logs', '--since', `${elapsed}s`, '--no-log-prefix', 'recommender']);
  const match = logs.match(OUTCOME);
  if (!match) continue;

  const line = match[0].trim();
  console.log(line);
  process.exit(line.includes('retrain complete') || line.includes('retrain skipped') ? 0 : 1);
}

die(`no result within ${TIMEOUT_MS / 1000}s — check: docker compose logs recommender`);
