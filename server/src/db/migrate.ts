import { createHash } from 'node:crypto';
import type { Logger } from '../core/logger';
import type { Db } from './sqlite';

/**
 * Migration runner.
 *
 * Migrations are forward-only SQL scripts applied inside a transaction and
 * recorded with a checksum, so a migration that was edited after it ran is
 * detected instead of silently diverging from the deployed schema.
 */

export interface Migration {
  /** Zero-padded, ordered, e.g. `003`. */
  id: string;
  /** Snake_case description, e.g. `scheduling`. */
  name: string;
  sql: string;
}

export interface AppliedMigration {
  id: string;
  name: string;
  checksum: string;
  applied_at: string;
}

export class MigrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MigrationError';
  }
}

const RegistryTable = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  checksum   TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`;

export function checksumOf(migration: Migration): string {
  return createHash('sha256').update(migration.sql, 'utf8').digest('hex');
}

export function assertUniqueOrderedIds(migrations: readonly Migration[]): void {
  const seen = new Set<string>();
  for (const migration of migrations) {
    if (!/^\d{3}$/.test(migration.id)) {
      throw new MigrationError(`migration id must be 3 digits, received '${migration.id}'`);
    }
    if (seen.has(migration.id)) {
      throw new MigrationError(`duplicate migration id '${migration.id}'`);
    }
    seen.add(migration.id);
  }
}

export function appliedMigrations(db: Db): AppliedMigration[] {
  db.exec(RegistryTable);
  return db.all<AppliedMigration>('SELECT * FROM schema_migrations ORDER BY id');
}

export function pendingMigrations(db: Db, migrations: readonly Migration[]): Migration[] {
  const applied = new Set(appliedMigrations(db).map((row) => row.id));
  return migrations.filter((migration) => !applied.has(migration.id));
}

/** Fail loudly if an already-applied migration's SQL was subsequently edited. */
export function verifyChecksums(db: Db, migrations: readonly Migration[]): void {
  const byId = new Map(migrations.map((migration) => [migration.id, migration]));
  for (const applied of appliedMigrations(db)) {
    const migration = byId.get(applied.id);
    if (!migration) {
      throw new MigrationError(
        `database has migration '${applied.id}' applied which no longer exists in this build`,
      );
    }
    const checksum = checksumOf(migration);
    if (checksum !== applied.checksum) {
      throw new MigrationError(
        `migration '${applied.id} ${applied.name}' was modified after it was applied ` +
          `(expected checksum ${applied.checksum.slice(0, 12)}, found ${checksum.slice(0, 12)}). ` +
          'Create a new migration instead of editing an applied one.',
      );
    }
  }
}

export interface MigrateResult {
  applied: string[];
  alreadyApplied: number;
}

/** Apply every pending migration in order. Safe to call on every boot. */
export function migrate(
  db: Db,
  migrations: readonly Migration[],
  logger?: Logger,
): MigrateResult {
  assertUniqueOrderedIds(migrations);
  verifyChecksums(db, migrations);

  const pending = pendingMigrations(db, migrations);
  const applied: string[] = [];

  for (const migration of pending) {
    try {
      db.transaction(() => {
        db.exec(migration.sql);
        db.run('INSERT INTO schema_migrations (id, name, checksum) VALUES (?, ?, ?)', [
          migration.id,
          migration.name,
          checksumOf(migration),
        ]);
      });
    } catch (error) {
      throw new MigrationError(`migration '${migration.id} ${migration.name}' failed`, {
        cause: error,
      });
    }
    applied.push(migration.id);
    logger?.info('db.migration.applied', { id: migration.id, name: migration.name });
  }

  return { applied, alreadyApplied: migrations.length - applied.length };
}

export function migrationStatus(
  db: Db,
  migrations: readonly Migration[],
): Array<{ id: string; name: string; applied: boolean; appliedAt: string | null }> {
  const applied = new Map(appliedMigrations(db).map((row) => [row.id, row]));
  return [...migrations]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((migration) => ({
      id: migration.id,
      name: migration.name,
      applied: applied.has(migration.id),
      appliedAt: applied.get(migration.id)?.applied_at ?? null,
    }));
}
