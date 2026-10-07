import {
  MigrationError,
  appliedMigrations,
  assertUniqueOrderedIds,
  checksumOf,
  migrate,
  migrationStatus,
  pendingMigrations,
  verifyChecksums,
  type Migration,
} from './migrate';
import { openDatabase, type Db } from './sqlite';

const users: Migration = {
  id: '001',
  name: 'users',
  sql: 'CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL)',
};

const orders: Migration = {
  id: '002',
  name: 'orders',
  sql: 'CREATE TABLE orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id))',
};

function withDb(fn: (db: Db) => void): void {
  const db = openDatabase(':memory:');
  try {
    fn(db);
  } finally {
    db.close();
  }
}

describe('assertUniqueOrderedIds', () => {
  it('accepts three-digit unique ids', () => {
    expect(() => assertUniqueOrderedIds([users, orders])).not.toThrow();
  });

  it('rejects malformed and duplicate ids', () => {
    expect(() => assertUniqueOrderedIds([{ id: '1', name: 'x', sql: '' }])).toThrow(
      MigrationError,
    );
    expect(() =>
      assertUniqueOrderedIds([users, { id: '001', name: 'again', sql: '' }]),
    ).toThrow(/duplicate/);
  });
});

describe('migrate', () => {
  it('applies pending migrations in order and records them', () => {
    withDb((db) => {
      const result = migrate(db, [users, orders]);
      expect(result.applied).toEqual(['001', '002']);
      expect(result.alreadyApplied).toBe(0);

      const rows = appliedMigrations(db);
      expect(rows.map((row) => row.id)).toEqual(['001', '002']);
      expect(rows[0]!.checksum).toBe(checksumOf(users));
      expect(rows[0]!.applied_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  it('is idempotent', () => {
    withDb((db) => {
      migrate(db, [users, orders]);
      const second = migrate(db, [users, orders]);
      expect(second.applied).toEqual([]);
      expect(second.alreadyApplied).toBe(2);
      expect(appliedMigrations(db)).toHaveLength(2);
    });
  });

  it('applies only the migrations added since the last run', () => {
    withDb((db) => {
      migrate(db, [users]);
      const result = migrate(db, [users, orders]);
      expect(result.applied).toEqual(['002']);
    });
  });

  it('rolls back a failing migration entirely', () => {
    withDb((db) => {
      const broken: Migration = {
        id: '001',
        name: 'broken',
        sql: `
          CREATE TABLE partial (id TEXT PRIMARY KEY);
          CREATE TABLE partial (id TEXT PRIMARY KEY);
        `,
      };
      expect(() => migrate(db, [broken])).toThrow(MigrationError);
      expect(db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'partial'")).toEqual([]);
      expect(appliedMigrations(db)).toHaveLength(0);
    });
  });

  it('leaves earlier migrations applied when a later one fails', () => {
    withDb((db) => {
      const broken: Migration = { id: '002', name: 'broken', sql: 'CREATE TABLE' };
      expect(() => migrate(db, [users, broken])).toThrow(/002 broken/);
      expect(appliedMigrations(db).map((row) => row.id)).toEqual(['001']);
    });
  });

  it('detects an edited migration via checksum', () => {
    withDb((db) => {
      migrate(db, [users]);
      const edited: Migration = { ...users, sql: `${users.sql} -- sneaky change` };
      expect(() => migrate(db, [edited])).toThrow(/modified after it was applied/);
      expect(() => verifyChecksums(db, [edited])).toThrow(MigrationError);
    });
  });

  it('detects a migration that disappeared from the build', () => {
    withDb((db) => {
      migrate(db, [users, orders]);
      expect(() => migrate(db, [users])).toThrow(/no longer exists in this build/);
    });
  });

  it('reports pending and status', () => {
    withDb((db) => {
      migrate(db, [users]);
      expect(pendingMigrations(db, [users, orders]).map((m) => m.id)).toEqual(['002']);
      expect(migrationStatus(db, [users, orders])).toEqual([
        { id: '001', name: 'users', applied: true, appliedAt: expect.any(String) },
        { id: '002', name: 'orders', applied: false, appliedAt: null },
      ]);
    });
  });

  it('applies a foreign-key constraint defined by a migration', () => {
    withDb((db) => {
      migrate(db, [users, orders]);
      expect(() =>
        db.run('INSERT INTO orders (id, user_id) VALUES (?, ?)', ['ord_1', 'usr_missing']),
      ).toThrow(/FOREIGN KEY/i);
    });
  });
});
