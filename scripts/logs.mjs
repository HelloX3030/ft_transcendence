/**
 * The things you routinely ask the logging stack, wrapped so they are readable.
 *
 * Elasticsearch and Kibana publish no port (see docker-compose.yml for why), so
 * every call runs inside a container where localhost:9200 is Elasticsearch
 * itself. The Elasticsearch image ships curl, which is what the calls use.
 *
 * Usage:
 *   npm run logs:status     # is the pipeline flowing, and how much has it indexed
 *   npm run logs:policies   # the retention and archive policies, and their state
 *   npm run logs:retrain    # the retrain report, on the terminal
 *
 * Each exits non-zero on a bad outcome — nothing indexed, a policy missing, a
 * failed retrain — so any of them can gate a CI step or a cron job.
 */
import { execFileSync } from 'node:child_process';

/** Repo root, so the script works from any cwd. */
const ROOT = new URL('..', import.meta.url).pathname;

const ES = 'http://localhost:9200';
const DATA_STREAM = 'logs-cinemates-default';

/**
 * Runs a curl inside the Elasticsearch container, authenticated as the
 * superuser whose password the container already holds in its environment.
 * `-T` because npm runs this without a TTY and `docker compose exec` would
 * otherwise fail outright. Returns null rather than throwing so callers can
 * report a friendly reason instead of a stack trace.
 */
function esGet(path) {
  try {
    const out = execFileSync(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        'elasticsearch',
        'sh',
        '-c',
        `curl -s -u "elastic:$ELASTIC_PASSWORD" '${ES}${path}'`,
      ],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 },
    );
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function die(message) {
  console.error(message);
  process.exit(1);
}

const unreachable =
  'Elasticsearch is not answering. Is the stack up?\n' +
  '  docker compose up -d elasticsearch logstash kibana';

function status() {
  const health = esGet('/_cluster/health');
  if (!health) die(unreachable);

  // yellow is the healthy steady state for one node: it cannot allocate the
  // replica shards it is asked for, and never will. Only red is a problem.
  const ok = health.status === 'green' || health.status === 'yellow';
  console.log(`cluster:   ${health.status}${health.status === 'yellow' ? ' (expected on a single node)' : ''}`);

  const count = esGet(`/${DATA_STREAM}/_count`);
  const indexed = count?.count ?? 0;
  console.log(`indexed:   ${indexed} log lines`);

  // Aggregations cannot be expressed as URI search parameters, so the request
  // body travels in `source` — the same escape hatch the retrain report uses,
  // and the reason both go through GET rather than POST.
  const services = esGet(
    `/${DATA_STREAM}/_search?source_content_type=application/json&source=` +
      encodeURIComponent(
        JSON.stringify({ size: 0, aggs: { by_service: { terms: { field: 'service' } } } }),
      ),
  );
  const buckets = services?.aggregations?.by_service?.buckets ?? [];
  for (const b of buckets) console.log(`  ${b.key.padEnd(14)} ${b.doc_count}`);

  if (!ok) die('cluster is red');
  if (indexed === 0) {
    die(
      'nothing indexed yet. Logstash reads the applications’ log files from the\n' +
        'shared volume, so give it a few seconds after the stack starts, then check:\n' +
        '  docker compose logs logstash',
    );
  }
}

function policies() {
  const ilm = esGet('/_ilm/policy/cinemates-logs');
  if (!ilm) die(unreachable);
  if (!ilm['cinemates-logs']) die('the ILM retention policy is missing. Run: docker compose up elk_setup');

  const phases = ilm['cinemates-logs'].policy.phases;
  console.log('retention (ILM policy cinemates-logs)');
  for (const [name, phase] of Object.entries(phases)) {
    const actions = Object.keys(phase.actions).join(', ') || 'none';
    console.log(`  ${name.padEnd(8)} at ${String(phase.min_age ?? '0ms').padEnd(6)}  ${actions}`);
  }

  const slm = esGet('/_slm/policy/cinemates-daily');
  if (!slm?.['cinemates-daily']) die('the SLM archive policy is missing. Run: docker compose up elk_setup');
  const policy = slm['cinemates-daily'];
  console.log('\narchive (SLM policy cinemates-daily)');
  console.log(`  schedule       ${policy.policy.schedule}`);
  console.log(`  repository     ${policy.policy.repository}`);
  console.log(`  keep           ${policy.policy.retention.expire_after}`);
  console.log(`  taken so far   ${policy.stats?.snapshots_taken ?? 0}`);
  if (policy.last_failure) console.log(`  last failure   ${JSON.stringify(policy.last_failure)}`);
}

function retrain() {
  const body = {
    size: 20,
    sort: [{ '@timestamp': 'desc' }],
    query: { term: { 'event.kind': 'retrain' } },
  };
  const hits = esGet(
    `/${DATA_STREAM}/_search?source_content_type=application/json&source=${encodeURIComponent(JSON.stringify(body))}`,
  );
  if (!hits) die(unreachable);

  const rows = hits.hits?.hits ?? [];
  if (rows.length === 0) {
    console.log('No retrain events indexed yet. Trigger one with: npm run retrain');
    return;
  }

  console.log('when                  outcome   interactions  users  movies  seconds');
  let failures = 0;
  for (const row of rows) {
    const s = row._source;
    const r = s.retrain ?? {};
    if (r.status === 'failed') failures += 1;
    console.log(
      `${s['@timestamp'].slice(0, 19).replace('T', ' ')}   ` +
        `${String(r.status).padEnd(9)} ${String(r.interactions ?? '').padStart(11)}  ` +
        `${String(r.users ?? '').padStart(5)}  ${String(r.movies ?? '').padStart(6)}  ` +
        `${String(r.duration_seconds ?? '').padStart(7)}`,
    );
  }
  console.log(`\nFull report: https://localhost:8443/kibana/app/dashboards#/view/cinemates-retrain-report`);
  if (failures > 0) die(`\n${failures} of the last ${rows.length} retrains failed`);
}

const commands = { status, policies, retrain };
const command = commands[process.argv[2]];
if (!command) die(`usage: node scripts/logs.mjs <${Object.keys(commands).join('|')}>`);
command();
