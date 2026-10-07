/**
 * Structured logging.
 *
 * One JSON object per line so logs can be shipped anywhere without a parser
 * change. Sensitive keys are redacted before serialisation — password hashes,
 * tokens, card data and auth headers must never reach a log sink.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  /** Where finished lines go. Defaults to stdout/stderr. */
  write?: (line: string, level: LogLevel) => void;
  /** Fields merged into every record produced by this logger. */
  base?: LogFields;
  /** Injectable clock so tests can assert timestamps. */
  now?: () => Date;
}

const LevelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SensitiveKeyPattern =
  /(password|passwd|secret|token|authorization|auth|cookie|cvv|cvc|card_?number|cardnumber|pan|api_?key|private)/i;

const MaxDepth = 6;

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MaxDepth) return '[truncated]';
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SensitiveKeyPattern.test(key) ? '[redacted]' : redact(entry, depth + 1);
    }
    return out;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[function]';
  return value;
}

function defaultWrite(line: string, level: LogLevel): void {
  if (level === 'error' || level === 'warn') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const write = options.write ?? defaultWrite;
  const base = options.base ?? {};
  const now = options.now ?? (() => new Date());
  const threshold = LevelPriority[level];

  const emit = (recordLevel: LogLevel, message: string, fields?: LogFields): void => {
    if (LevelPriority[recordLevel] < threshold) return;
    const timestamp = now().toISOString();
    let line: string;
    try {
      // A log call must never take the process down: hostile getters, circular
      // references and custom toJSON implementations are all caught here.
      line = JSON.stringify({
        timestamp,
        level: recordLevel,
        message,
        ...(redact({ ...base, ...fields }) as LogFields),
      });
    } catch {
      line = JSON.stringify({
        timestamp,
        level: recordLevel,
        message,
        logError: 'record not serialisable',
      });
    }
    write(line, recordLevel);
  };

  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
    child: (fields) =>
      createLogger({ ...options, level, write, now, base: { ...base, ...fields } }),
  };
}

/** A logger that swallows everything — handy in unit tests. */
export function createSilentLogger(): Logger {
  return createLogger({ level: 'error', write: () => undefined });
}
