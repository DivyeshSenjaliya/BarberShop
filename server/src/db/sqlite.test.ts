import { openDatabase, toSqlValue, type Db } from './sqlite';

function withDb(fn: (db: Db) => void): void {
  const db = openDatabase(':memory:');
  try {
    fn(db);
  } finally {
    db.close();
  }
}

describe('toSqlValue', () => {
  it('normalises JS values SQLite cannot store natively', () => {
    expect(toSqlValue(undefined)).toBeNull();
    expect(toSqlValue(null)).toBeNull();
    expect(toSqlValue(true)).toBe(1);
    expect(toSqlValue(false)).toBe(0);
    expect(toSqlValue(new Date('2026-10-07T10:00:00Z'))).toBe('2026-10-07T10:00:00.000Z');
    expect(toSqlValue('text')).toBe('text');
    expect(toSqlValue(42)).toBe(42);
    expect(toSqlValue({ a: 1 })).toBe('{"a":1}');
  });

  it('rejects values that cannot be stored', () => {
    expect(() => toSqlValue(Symbol('x'))).toThrow(TypeError);
    expect(() => toSqlValue(() => undefined)).toThrow(TypeError);
  });
});

describe('openDatabase', () => {
  it('enforces foreign keys', () => {
    withDb((db) => {
      db.exec('CREATE TABLE parent (id TEXT PRIMARY KEY)');
      db.exec('CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parent(id))');
      expect(() => db.run('INSERT INTO child (id, parent_id) VALUES (?, ?)', ['c1', 'missing'])).toThrow(
        /FOREIGN KEY/i,
      );
    });
  });

  it('runs queries with positional and named parameters', () => {
    withDb((db) => {
      db.exec('CREATE TABLE items (id TEXT PRIMARY KEY, qty INTEGER, flag INTEGER)');
      db.run('INSERT INTO items (id, qty, flag) VALUES ($id, $qty, $flag)', {
        $id: 'a',
        $qty: 3,
        $flag: true,
      });
      expect(db.get<{ qty: number }>('SELECT qty FROM items WHERE id = ?', ['a'])?.qty).toBe(3);
      expect(db.all('SELECT * FROM items')).toHaveLength(1);
      expect(db.get('SELECT * FROM items WHERE id = ?', ['nope'])).toBeUndefined();
    });
  });

  it('reports affected row counts', () => {
    withDb((db) => {
      db.exec('CREATE TABLE items (id TEXT PRIMARY KEY)');
      db.run('INSERT INTO items (id) VALUES (?)', ['a']);
      const updated = db.run('UPDATE items SET id = ?', ['b']);
      expect(updated.changes).toBe(1);
      const missing = db.run('DELETE FROM items WHERE id = ?', ['ghost']);
      expect(missing.changes).toBe(0);
    });
  });

  it('commits transactions', () => {
    withDb((db) => {
      db.exec('CREATE TABLE items (id TEXT PRIMARY KEY)');
      const result = db.transaction(() => {
        db.run('INSERT INTO items (id) VALUES (?)', ['a']);
        return 'done';
      });
      expect(result).toBe('done');
      expect(db.all('SELECT * FROM items')).toHaveLength(1);
    });
  });

  it('rolls back the whole transaction on failure', () => {
    withDb((db) => {
      db.exec('CREATE TABLE items (id TEXT PRIMARY KEY)');
      expect(() =>
        db.transaction(() => {
          db.run('INSERT INTO items (id) VALUES (?)', ['a']);
          throw new Error('business rule failed');
        }),
      ).toThrow('business rule failed');
      expect(db.all('SELECT * FROM items')).toHaveLength(0);
    });
  });

  it('supports nested transactions via savepoints', () => {
    withDb((db) => {
      db.exec('CREATE TABLE items (id TEXT PRIMARY KEY)');
      db.transaction(() => {
        db.run('INSERT INTO items (id) VALUES (?)', ['outer']);
        try {
          db.transaction(() => {
            db.run('INSERT INTO items (id) VALUES (?)', ['inner']);
            throw new Error('inner failed');
          });
        } catch {
          // swallowed: only the inner savepoint rolls back
        }
        db.run('INSERT INTO items (id) VALUES (?)', ['after']);
      });
      expect(db.all<{ id: string }>('SELECT id FROM items ORDER BY id').map((row) => row.id)).toEqual([
        'after',
        'outer',
      ]);
    });
  });

  it('keeps the connection usable after a rolled-back outer transaction', () => {
    withDb((db) => {
      db.exec('CREATE TABLE items (id TEXT PRIMARY KEY)');
      expect(() =>
        db.transaction(() => {
          throw new Error('nope');
        }),
      ).toThrow('nope');
      db.run('INSERT INTO items (id) VALUES (?)', ['next']);
      expect(db.all('SELECT * FROM items')).toHaveLength(1);
    });
  });
});
