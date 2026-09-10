"""
Structured logging for the ELK pipeline.

The service keeps its existing human-readable console output exactly as it was —
that is what `docker compose logs recommender` shows and what everyone already
reads while developing. This module adds a *second* destination: one JSON object
per line, appended to a file on the shared log volume, where Logstash collects
it. Nothing is taken away, so a failure anywhere in this module can cost the
dashboards but not the ordinary logs.

The file is opened in append mode and never rotated here. Rotation is
Elasticsearch's job once the line is indexed, and a rotating handler in every
service would mean four processes competing to rename the same file.
"""

import json
import logging
import os
from datetime import datetime, timezone

SERVICE_NAME = "recommender"

# Attributes the stdlib puts on every LogRecord. Anything *not* in here was
# attached by the caller through `extra=` and is therefore part of the event,
# which is what makes `logger.info(..., extra={"retrain": {...}})` work without
# this module needing to know about retrain at all.
_STANDARD_FIELDS = frozenset(
    """
    args asctime created exc_info exc_text filename funcName levelname levelno
    lineno module msecs message msg name pathname process processName
    relativeCreated stack_info taskName thread threadName
    """.split()
)


class JsonFormatter(logging.Formatter):
    """
    Renders a LogRecord as the single-line JSON object the pipeline expects.

    The field names are a contract with logstash/pipeline/logstash.conf and the
    index template in elasticsearch/setup/setup.sh — changing one of them means
    changing all three, or the field silently stops being searchable.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            # Explicitly UTC and ISO 8601, which is what the date filter in the
            # pipeline is told to parse. The stdlib's own asctime is local time
            # with no offset, so two services in different timezones would
            # produce timestamps that cannot be ordered against each other.
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "service": SERVICE_NAME,
            "message": record.getMessage(),
        }

        # Traceback text, when logger.exception() was used. Kept as one string:
        # it is read, not aggregated.
        if record.exc_info:
            payload["error"] = {"stack_trace": self.formatException(record.exc_info)}

        # Everything the caller passed via extra=. Non-serialisable values are
        # coerced to their repr rather than raising, because a logging call must
        # never be the thing that breaks a request.
        for key, value in record.__dict__.items():
            if key in _STANDARD_FIELDS or key.startswith("_"):
                continue
            payload[key] = value

        return json.dumps(payload, default=repr)


def configure(log_dir: str | None = None) -> None:
    """
    Attach the JSON file handler to the root logger.

    Silent no-op when the directory is absent or unwritable, which is the case
    when the service runs outside Docker — the unit tests import this package
    and must not need a log volume to do it.
    """
    log_dir = log_dir or os.getenv("LOG_DIR", "/var/log/cinemates")

    try:
        os.makedirs(log_dir, exist_ok=True)
        handler = logging.FileHandler(
            os.path.join(log_dir, f"{SERVICE_NAME}.log"), encoding="utf-8"
        )
    except OSError as exc:
        # Deliberately a warning on the console rather than a raise. A missing
        # log volume should degrade the dashboards, not stop the recommender
        # from serving a feed.
        logging.getLogger(__name__).warning(
            "structured logging disabled, %s is not writable: %s", log_dir, exc
        )
        return

    handler.setFormatter(JsonFormatter())
    logging.getLogger().addHandler(handler)
    logging.getLogger(__name__).info("structured logging enabled", extra={"log_dir": log_dir})
