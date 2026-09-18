#!/bin/bash
# One-shot configuration of Elasticsearch, run to completion before Kibana and
# Logstash are allowed to start.
#
# Everything here is idempotent: each call is a PUT of a named object, so a
# `docker compose up` on an existing stack re-asserts the same configuration
# rather than failing on "already exists". That matters because this container
# runs on every boot, not just the first.
set -euo pipefail

ES="http://elasticsearch:9200"
AUTH="elastic:${ELASTIC_PASSWORD}"

# curl flags used everywhere: fail loudly on an HTTP error (--fail-with-body
# still prints Elasticsearch's explanation, which plain --fail swallows), stay
# silent about progress, and never follow a redirect to somewhere unauthenticated.
CURL=(curl --fail-with-body --silent --show-error --max-time 30 -u "$AUTH" -H "Content-Type: application/json")

echo "setup: waiting for Elasticsearch to accept requests"
# The container healthcheck already gates on this, but depends_on only
# guarantees the healthcheck passed once. A cluster that has just gone yellow
# during startup would still reject writes, so wait on the status itself.
for attempt in $(seq 1 60); do
  if "${CURL[@]}" "$ES/_cluster/health?wait_for_status=yellow&timeout=5s" >/dev/null 2>&1; then
    echo "setup: Elasticsearch is up"
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    echo "setup: Elasticsearch did not become ready in time" >&2
    exit 1
  fi
  sleep 2
done

# --- Kibana's own credentials --------------------------------------------
# Kibana does not log in as the `elastic` superuser; it uses the built-in
# `kibana_system` account, which can manage its own indices and nothing else.
# The account exists from the start but has no usable password until one is
# set, which is what this does. Compromising the Kibana container therefore
# does not hand over the cluster.
echo "setup: setting the kibana_system password"
"${CURL[@]}" -X POST "$ES/_security/user/kibana_system/_password" \
  -d "{\"password\":\"${KIBANA_SYSTEM_PASSWORD}\"}" >/dev/null

# --- Retention ------------------------------------------------------------
# Fifteen days, matching the Prometheus retention this project already runs, so
# a log line and the metric that goes with it disappear together and an
# investigation never has half of the evidence.
#
# Rollover closes the current backing index once it reaches a day old or 512 MB,
# whichever comes first. The size cap is what protects the disk on a machine
# where a loop starts logging in earnest; the age cap is what keeps a quiet
# stack from holding one index open for a fortnight.
echo "setup: installing the ILM retention policy"
"${CURL[@]}" -X PUT "$ES/_ilm/policy/cinemates-logs" -d '{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": { "max_age": "1d", "max_primary_shard_size": "512mb" }
        }
      },
      "warm": {
        "min_age": "2d",
        "actions": {
          "forcemerge": { "max_num_segments": 1 },
          "readonly": {}
        }
      },
      "delete": {
        "min_age": "15d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}' >/dev/null

# --- Mappings -------------------------------------------------------------
# Without an explicit template Elasticsearch guesses a type from the first
# document it sees, and guesses wrong in the two ways that hurt: a duration
# that happens to arrive as 0 becomes a long and later rejects 1.4, and every
# string becomes both a full-text field and a keyword, doubling the index.
#
# `service` and `level` are keyword-only: they are filtered and grouped on,
# never searched for a word inside. `message` is text, because it is.
echo "setup: installing the index template"
"${CURL[@]}" -X PUT "$ES/_index_template/logs-cinemates" -d '{
  "index_patterns": ["logs-cinemates-*"],
  "data_stream": {},
  "priority": 500,
  "template": {
    "settings": {
      "index.lifecycle.name": "cinemates-logs",
      "number_of_shards": 1,
      "number_of_replicas": 0
    },
    "mappings": {
      "properties": {
        "@timestamp":     { "type": "date" },
        "service":        { "type": "keyword" },
        "level":          { "type": "keyword" },
        "level_severity": { "type": "integer" },
        "logger":         { "type": "keyword" },
        "message":        { "type": "text" },
        "event": {
          "properties": {
            "kind": { "type": "keyword" }
          }
        },
        "retrain": {
          "properties": {
            "status":           { "type": "keyword" },
            "ok":               { "type": "boolean" },
            "interactions":     { "type": "integer" },
            "users":            { "type": "integer" },
            "movies":           { "type": "integer" },
            "duration_seconds": { "type": "float" },
            "rows_per_second":  { "type": "float" },
            "detail":           { "type": "text" }
          }
        }
      }
    }
  }
}' >/dev/null

# --- Archiving ------------------------------------------------------------
# Docker creates the mount point for a named volume as root when the path does
# not exist in the image, and Elasticsearch runs as uid 1000. Left alone, the
# repository registration below fails with access_denied on the very directory
# it is meant to write backups into. Group 0 rather than 1000 because that is
# what the Elasticsearch image itself uses for its own directories.
echo "setup: fixing snapshot volume ownership"
chown 1000:0 /snapshots
chmod 770 /snapshots

# Retention deletes; archiving keeps a copy that outlives the deletion. A
# filesystem repository on a named volume is the honest local equivalent of the
# object storage a real deployment would use — the same API, the same restore
# procedure, no cloud account needed to demonstrate it.
echo "setup: registering the snapshot repository"
"${CURL[@]}" -X PUT "$ES/_snapshot/cinemates-archive" -d '{
  "type": "fs",
  "settings": {
    "location": "/snapshots",
    "compress": true
  }
}' >/dev/null

# Snapshot Lifecycle Management runs the archive on a schedule inside
# Elasticsearch, so it happens whether or not anyone is watching, and keeps
# thirty days of daily snapshots — twice the ILM window, so a log line deleted
# by retention is still recoverable from an archive for another fortnight.
echo "setup: installing the SLM archive policy"
"${CURL[@]}" -X PUT "$ES/_slm/policy/cinemates-daily" -d '{
  "name": "<cinemates-logs-{now/d}>",
  "schedule": "0 30 2 * * ?",
  "repository": "cinemates-archive",
  "config": {
    "indices": ["logs-cinemates-*"],
    "include_global_state": false
  },
  "retention": {
    "expire_after": "30d",
    "min_count": 5,
    "max_count": 50
  }
}' >/dev/null

echo "setup: done"
