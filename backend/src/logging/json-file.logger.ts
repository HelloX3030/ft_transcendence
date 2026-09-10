import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nest's normal console logger, plus a second destination: one JSON object per
 * line appended to the shared log volume, where Logstash collects it.
 *
 * It extends ConsoleLogger rather than replacing it so the terminal output every
 * developer already reads is byte-for-byte what it was. The JSON is additive,
 * and if the volume is missing the logger quietly becomes an ordinary
 * ConsoleLogger again — a backend must not refuse to boot because a log
 * directory is unwritable.
 *
 * Field names here are a contract with logstash/pipeline/logstash.conf and the
 * index template in elasticsearch/setup/setup.sh. Renaming one without the
 * other two does not fail; the field just stops being searchable, which is
 * worse.
 */
export class JsonFileLogger extends ConsoleLogger {
  private readonly file: string | null;

  constructor() {
    super();
    const dir = process.env.LOG_DIR ?? '/var/log/cinemates';
    let file: string | null = null;
    try {
      mkdirSync(dir, { recursive: true });
      file = join(dir, 'backend.log');
    } catch {
      // Left null; every write below becomes a no-op and the console half of
      // this logger carries on untouched.
    }
    this.file = file;
  }

  private write(level: LogLevel, message: unknown, context?: string, stack?: string): void {
    if (!this.file) return;
    try {
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        level,
        service: 'backend',
        logger: context ?? this.context ?? 'Nest',
        message: typeof message === 'string' ? message : JSON.stringify(message),
        ...(stack ? { error: { stack_trace: stack } } : {}),
      });
      // Synchronous on purpose. An async write can still be queued when the
      // process exits, which loses precisely the log line explaining why it
      // exited. These are single short appends, not a hot path.
      appendFileSync(this.file, line + '\n');
    } catch {
      // A logger that throws turns a recoverable error into a crash.
    }
  }

  log(message: unknown, context?: string): void {
    super.log(message, context);
    this.write('log', message, context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    super.error(message, stack, context);
    this.write('error', message, context, stack);
  }

  warn(message: unknown, context?: string): void {
    super.warn(message, context);
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    super.debug(message, context);
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    super.verbose(message, context);
    this.write('verbose', message, context);
  }
}
