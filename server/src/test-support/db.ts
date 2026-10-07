import { loadConfig, type AppConfig } from '../core/config';
import { createLogger, createSilentLogger, type Logger } from '../core/logger';
import { migrate } from '../db/migrate';
import { migrations } from '../db/migrations';
import { openDatabase, type Db } from '../db/sqlite';

/**
 * Shared test fixtures: a migrated in-memory database, a deterministic
 * config and a logger that stays quiet unless a test asks for its output.
 */

export function createTestDb(): Db {
  const db = openDatabase(':memory:');
  migrate(db, migrations);
  return db;
}

export function createTestConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({ NODE_ENV: 'test', ...overrides });
}

export function createTestLogger(): Logger {
  return createSilentLogger();
}

/** Collect log lines emitted while the test runs. */
export function captureLogs(): { lines: Array<Record<string, unknown>>; logger: Logger } {
  const lines: Array<Record<string, unknown>> = [];
  const logger = createLogger({
    level: 'debug',
    write: (line) => lines.push(JSON.parse(line) as Record<string, unknown>),
  });
  return { lines, logger };
}
