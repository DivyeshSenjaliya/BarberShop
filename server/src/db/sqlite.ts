import { DatabaseSync, type StatementSync } from 'node:sqlite';

/**
 * Thin, typed wrapper over `node:sqlite`.
 *
 * Responsibilities kept here (and nowhere else): connection setup and
 * pragmas, parameter normalisation (JS booleans/dates are not SQLite
 * values), statement caching, and transaction nesting via savepoints so
 * services can compose without knowing they share a connection.
 */

export type SqlValue = string | number | bigint | null | Uint8Array;
export type SqlParams = Record<string, unknown> | readonly unknown[];

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface Db {
  /** Execute one or more statements with no parameters. */
  exec(sql: string): void;
  run(sql: string, params?: SqlParams): RunResult;
  get<T = Record<string, unknown>>(sql: string, params?: SqlParams): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: SqlParams): T[];
  /** Run `fn` inside a transaction (savepoint when already inside one). */
  transaction<T>(fn: () => T): T;
  close(): void;
  readonly path: string;
}

/** Convert a JS value into something SQLite accepts. */
export function toSqlValue(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  throw new TypeError(`cannot bind value of type ${typeof value} to SQL`);
}

function normaliseParams(params: SqlParams | undefined): SqlValue[] | [Record<string, SqlValue>] {
  if (params === undefined) return [];
  if (Array.isArray(params)) return (params as readonly unknown[]).map(toSqlValue);
  const bag: Record<string, SqlValue> = {};
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    bag[key] = toSqlValue(value);
  }
  return [bag];
}

class SqliteDb implements Db {
  readonly path: string;
  private readonly handle: DatabaseSync;
  private readonly cache = new Map<string, StatementSync>();
  private depth = 0;

  constructor(path: string) {
    this.path = path;
    this.handle = new DatabaseSync(path);
    this.handle.exec('PRAGMA foreign_keys = ON');
    this.handle.exec('PRAGMA busy_timeout = 5000');
    if (path !== ':memory:') {
      this.handle.exec('PRAGMA journal_mode = WAL');
      this.handle.exec('PRAGMA synchronous = NORMAL');
    }
  }

  private prepare(sql: string): StatementSync {
    let statement = this.cache.get(sql);
    if (!statement) {
      statement = this.handle.prepare(sql);
      this.cache.set(sql, statement);
    }
    return statement;
  }

  exec(sql: string): void {
    this.cache.clear(); // schema changes can invalidate prepared statements
    this.handle.exec(sql);
  }

  run(sql: string, params?: SqlParams): RunResult {
    const result = this.prepare(sql).run(...(normaliseParams(params) as never[]));
    return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
  }

  get<T = Record<string, unknown>>(sql: string, params?: SqlParams): T | undefined {
    return this.prepare(sql).get(...(normaliseParams(params) as never[])) as T | undefined;
  }

  all<T = Record<string, unknown>>(sql: string, params?: SqlParams): T[] {
    return this.prepare(sql).all(...(normaliseParams(params) as never[])) as T[];
  }

  transaction<T>(fn: () => T): T {
    const isOutermost = this.depth === 0;
    const savepoint = `sp_${this.depth}`;
    this.exec(isOutermost ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
    this.depth += 1;
    try {
      const result = fn();
      this.depth -= 1;
      this.exec(isOutermost ? 'COMMIT' : `RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      this.depth -= 1;
      try {
        this.exec(isOutermost ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
      } catch {
        // The connection is already unwinding; surface the original failure.
      }
      throw error;
    }
  }

  close(): void {
    this.cache.clear();
    this.handle.close();
  }
}

export function openDatabase(path: string): Db {
  return new SqliteDb(path);
}
