import { migrate, migrationStatus } from './migrate';
import { migrations } from './migrations';
import { openDatabase, type Db } from './sqlite';

/**
 * The registry itself must always be applicable to a fresh database —
 * a broken migration should fail here, not in production.
 */
describe('migration registry', () => {
  let db: Db;

  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('applies every registered migration to an empty database', () => {
    const result = migrate(db, migrations);
    expect(result.applied).toEqual(migrations.map((migration) => migration.id));
    expect(migrationStatus(db, migrations).every((row) => row.applied)).toBe(true);
  });

  it('is idempotent on a second run', () => {
    migrate(db, migrations);
    expect(migrate(db, migrations).applied).toEqual([]);
  });

  it('creates the identity tables expected by the auth layer', () => {
    migrate(db, migrations);
    const tables = db
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);

    for (const table of ['schema_migrations', 'users', 'addresses', 'auth_sessions', 'auth_tokens']) {
      expect(tables).toContain(table);
    }
  });

  it('enforces the user constraints declared in the schema', () => {
    migrate(db, migrations);
    const insert = (id: string, email: string, role = 'customer'): void => {
      db.run(
        `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                            first_name, last_name, display_name, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, email, email.toLowerCase(), 'scrypt$…', '2026-10-07T00:00:00.000Z', 'Kim', 'Lee', 'Kim Lee', role],
      );
    };

    insert('usr_1', 'kim@example.com');
    expect(() => insert('usr_2', 'kim@example.com')).toThrow(/UNIQUE/i);
    expect(() => insert('usr_3', 'bad@example.com', 'superuser')).toThrow(/CHECK/i);

    // Soft-deleted users free up the address for re-registration.
    db.run("UPDATE users SET deleted_at = '2026-10-07T00:00:00.000Z' WHERE id = 'usr_1'");
    expect(() => insert('usr_4', 'kim@example.com')).not.toThrow();
  });

  it('rejects a user row missing required columns', () => {
    migrate(db, migrations);
    expect(() =>
      db.run('INSERT INTO users (id, email, email_normalised) VALUES (?, ?, ?)', [
        'usr_x',
        'a@example.com',
        'a@example.com',
      ]),
    ).toThrow(/NOT NULL/i);
  });

  it('allows at most one default address per user', () => {
    migrate(db, migrations);
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name)
       VALUES ('usr_1', 'a@example.com', 'a@example.com', 'h', '2026-10-07T00:00:00.000Z', 'A', 'B', 'A B')`,
    );
    const insertAddress = (id: string, isDefault: number): void => {
      db.run(
        `INSERT INTO addresses (id, user_id, label, line1, city, postal_code, country, is_default)
         VALUES (?, ?, 'Home', '1 Main St', 'Springfield', '12345', 'US', ?)`,
        [id, 'usr_1', isDefault],
      );
    };

    insertAddress('addr_1', 1);
    expect(() => insertAddress('addr_2', 1)).toThrow(/UNIQUE/i);
    expect(() => insertAddress('addr_3', 0)).not.toThrow();
  });

  it('cascades sessions and addresses when a user is deleted', () => {
    migrate(db, migrations);
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name)
       VALUES ('usr_1', 'a@example.com', 'a@example.com', 'h', '2026-10-07T00:00:00.000Z', 'A', 'B', 'A B')`,
    );
    db.run(
      `INSERT INTO addresses (id, user_id, label, line1, city, postal_code, country)
       VALUES ('addr_1', 'usr_1', 'Home', '1 Main St', 'Springfield', '12345', 'US')`,
    );
    db.run(
      `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, issued_at, expires_at)
       VALUES ('ses_1', 'usr_1', 'hash', '2026-10-07T00:00:00.000Z', '2026-11-06T00:00:00.000Z')`,
    );

    db.run("DELETE FROM users WHERE id = 'usr_1'");
    expect(db.all('SELECT * FROM addresses')).toHaveLength(0);
    expect(db.all('SELECT * FROM auth_sessions')).toHaveLength(0);
  });

  it('stores only hashed refresh tokens', () => {
    migrate(db, migrations);
    const columns = db.all<{ name: string }>('PRAGMA table_info(auth_sessions)');
    expect(columns.map((column) => column.name)).not.toContain('refresh_token');
    expect(columns.map((column) => column.name)).toContain('refresh_token_hash');
  });
});
