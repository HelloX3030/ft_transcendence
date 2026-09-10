#!/bin/bash
# Imports the Kibana half of the configuration: the data view that tells Kibana
# which indices to read, and the dashboards built on it.
#
# Kept in the repository rather than clicked together in the UI for the same
# reason Grafana's dashboards are: a dashboard that exists only inside a volume
# is lost the first time someone runs `docker compose down -v`, and cannot be
# reviewed in a pull request.
set -euo pipefail

KIBANA="http://kibana:5601/kibana"
AUTH="elastic:${ELASTIC_PASSWORD}"

echo "dashboards: waiting for Kibana to report available"
for attempt in $(seq 1 60); do
  if curl -sf -u "$AUTH" "$KIBANA/api/status" 2>/dev/null | grep -q '"level":"available"'; then
    echo "dashboards: Kibana is up"
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    echo "dashboards: Kibana did not become available in time" >&2
    exit 1
  fi
  sleep 5
done

# overwrite=true so an edited dashboard in the repository wins over whatever is
# currently saved. The saved objects carry fixed ids for exactly this reason:
# without them every boot would import a second copy under a new random id.
for file in /saved-objects/*.ndjson; do
  [ -e "$file" ] || continue
  echo "dashboards: importing $(basename "$file")"
  # kbn-xsrf is required on every Kibana write endpoint; its value is ignored,
  # its presence is what proves the call is not a cross-site form post.
  response=$(curl --fail-with-body --silent --show-error \
    -u "$AUTH" \
    -H "kbn-xsrf: true" \
    -X POST "$KIBANA/api/saved_objects/_import?overwrite=true" \
    --form "file=@${file}")

  # The import endpoint answers 200 even when individual objects fail, so the
  # body is the only place a failure shows up.
  if ! echo "$response" | grep -q '"success":true'; then
    echo "dashboards: import reported a failure" >&2
    echo "$response" >&2
    exit 1
  fi
  echo "dashboards: $(basename "$file") imported"
done

echo "dashboards: done"
