/**
 * The two things you routinely ask Prometheus, wrapped so they are readable.
 *
 * Prometheus publishes no port (see docker-compose.yml for why), so both
 * subcommands run inside the container, where localhost:9090 is Prometheus
 * itself. The image ships busybox wget and no curl, hence the wget calls.
 *
 * Usage:
 *   npm run metrics:targets   # what is being scraped, and is it healthy
 *   npm run metrics:reload    # re-read prometheus.yml without a restart
 *
 * Both exit non-zero on a bad outcome — a target down, or a config that does
 * not parse — so either can gate a CI step or a cron job.
 */
import { execFileSync } from 'node:child_process';

/** Repo root, so the script works from any cwd. */
const ROOT = new URL('..', import.meta.url).pathname;

const PROM = 'http://localhost:9090';

/**
 * Runs a command in the Prometheus container. `-T` because npm runs this
 * without a TTY, and `docker compose exec` would otherwise fail outright.
 * Returns null rather than throwing so callers can report a friendly reason.
 */
function inContainer(args) {
  try {
    return execFileSync('docker', ['compose', 'exec', '-T', 'prometheus', ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function requireRunning() {
  if (inContainer(['wget', '-q', '--spider', `${PROM}/-/healthy`]) === null) {
    console.error('Prometheus is not reachable. Is the stack up? (docker compose up -d)');
    process.exit(1);
  }
}

/**
 * Seconds since an ISO timestamp, for the "how stale is this" column. A target
 * that has not been scraped yet reports Go's zero time (year 1), which would
 * otherwise render as a million-minute age, so anything absurd reads "never".
 */
function ago(iso) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds > 86_400) return 'never';
  return seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`;
}

/**
 * The replacement for Prometheus' /targets web page. Every exporter added from
 * here on is checked with this: a wrong port or an unreachable host shows up as
 * `down` with the connection error beside it.
 */
function targets() {
  requireRunning();

  const raw = inContainer(['wget', '-qO-', `${PROM}/api/v1/targets?state=active`]);
  if (raw === null) {
    console.error('Could not read the targets API.');
    process.exit(1);
  }

  const active = JSON.parse(raw).data.activeTargets;
  if (active.length === 0) {
    console.log('No active targets. Check scrape_configs in prometheus/prometheus.yml.');
    process.exit(1);
  }

  const rows = active.map((target) => ({
    job: target.labels.job,
    health: target.health,
    endpoint: target.scrapeUrl,
    last: ago(target.lastScrape),
    error: target.lastError || '',
  }));

  const width = (key, heading) => Math.max(heading.length, ...rows.map((row) => row[key].length));
  const widths = {
    job: width('job', 'JOB'),
    health: width('health', 'HEALTH'),
    endpoint: width('endpoint', 'ENDPOINT'),
    last: width('last', 'LAST SCRAPE'),
  };
  const line = (job, health, endpoint, last, error) =>
    [
      job.padEnd(widths.job),
      health.padEnd(widths.health),
      endpoint.padEnd(widths.endpoint),
      last.padEnd(widths.last),
      error,
    ]
      .join('  ')
      .trimEnd();

  console.log(line('JOB', 'HEALTH', 'ENDPOINT', 'LAST SCRAPE', 'ERROR'));
  for (const row of rows) {
    console.log(line(row.job, row.health, row.endpoint, row.last, row.error));
  }

  const down = rows.filter((row) => row.health !== 'up');
  if (down.length > 0) {
    console.error(`\n${down.length} of ${rows.length} targets are not up.`);
    process.exit(1);
  }
  console.log(`\nAll ${rows.length} targets up.`);
}

/**
 * Applies an edited prometheus.yml without restarting the process, so there is
 * no gap in the graphs and no write-ahead-log replay.
 *
 * The config is checked first with promtool, which ships in the image: a reload
 * on a broken config is refused and Prometheus keeps running the old one, so
 * without this step a typo looks like "the change did nothing".
 */
function reload() {
  requireRunning();

  const check = inContainer(['promtool', 'check', 'config', '/etc/prometheus/prometheus.yml']);
  if (check === null) {
    // promtool prints the offending line and field to stderr; re-run it with
    // output attached so the developer sees exactly what it objected to.
    console.error('prometheus.yml did not pass promtool. Nothing was reloaded.\n');
    try {
      execFileSync(
        'docker',
        [
          'compose',
          'exec',
          '-T',
          'prometheus',
          'promtool',
          'check',
          'config',
          '/etc/prometheus/prometheus.yml',
        ],
        { cwd: ROOT, stdio: 'inherit' },
      );
    } catch {
      // The non-zero exit is the point; its output has already been printed.
    }
    process.exit(1);
  }
  console.log('prometheus.yml is valid.');

  // POST, not GET: the endpoint refuses anything else. Enabled by
  // --web.enable-lifecycle in docker-compose.yml.
  if (inContainer(['wget', '--post-data=', '-qO-', `${PROM}/-/reload`]) === null) {
    console.error('Reload was refused. Is --web.enable-lifecycle still set?');
    process.exit(1);
  }
  console.log('Configuration reloaded. Stored data was not touched.');
}

const command = process.argv[2];
if (command === 'targets') targets();
else if (command === 'reload') reload();
else {
  console.error('Usage: node scripts/prometheus.mjs <targets|reload>');
  process.exit(1);
}
