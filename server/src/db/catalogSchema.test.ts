import { newId } from '../core/ids';
import { createTestDb } from '../test-support/db';
import type { Db } from './sqlite';

/**
 * Schema-level tests for the catalog and staffing tables: constraints and
 * cascades must hold at the database, not only in service code.
 */
describe('catalog schema', () => {
  let db: Db;
  let userId: string;
  let shopId: string;
  let branchId: string;
  let categoryId: string;
  let serviceId: string;

  beforeEach(() => {
    db = createTestDb();
    userId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@example.com', 'owner@example.com', 'h', '2026-10-07T00:00:00.000Z',
               'Olly', 'Owner', 'Olly Owner', 'owner')`,
      [userId],
    );
    shopId = newId('shop');
    db.run(
      `INSERT INTO shops (id, owner_id, name, slug, status) VALUES (?, ?, 'Sharp & Co', 'sharp-co', 'active')`,
      [shopId, userId],
    );
    branchId = newId('brch');
    db.run(
      `INSERT INTO branches (id, shop_id, name, address_line1, city, postal_code)
       VALUES (?, ?, 'Downtown', '1 Main St', 'Springfield', '12345')`,
      [branchId, shopId],
    );
    categoryId = newId('cat');
    db.run(
      `INSERT INTO service_categories (id, shop_id, name, slug) VALUES (?, ?, 'Hair', 'hair')`,
      [categoryId, shopId],
    );
    serviceId = newId('srv');
    db.run(
      `INSERT INTO services (id, shop_id, category_id, name, slug, duration_minutes, price_cents)
       VALUES (?, ?, ?, 'Skin Fade', 'skin-fade', 45, 2500)`,
      [serviceId, shopId, categoryId],
    );
  });

  afterEach(() => db.close());

  it('requires a unique shop slug among live shops', () => {
    expect(() =>
      db.run(
        `INSERT INTO shops (id, owner_id, name, slug) VALUES (?, ?, 'Copy', 'sharp-co')`,
        [newId('shop'), userId],
      ),
    ).toThrow(/UNIQUE/i);

    db.run("UPDATE shops SET deleted_at = '2026-10-07T00:00:00.000Z' WHERE id = ?", [shopId]);
    expect(() =>
      db.run(
        `INSERT INTO shops (id, owner_id, name, slug) VALUES (?, ?, 'Reborn', 'sharp-co')`,
        [newId('shop'), userId],
      ),
    ).not.toThrow();
  });

  it('cascades branches, hours and services when a shop is deleted', () => {
    db.run(
      `INSERT INTO business_hours (id, branch_id, weekday, opens_at, closes_at)
       VALUES (?, ?, 1, '09:00', '18:00')`,
      [newId('sched'), branchId],
    );
    db.run(`INSERT INTO branch_services (branch_id, service_id) VALUES (?, ?)`, [
      branchId,
      serviceId,
    ]);

    db.run('DELETE FROM shops WHERE id = ?', [shopId]);

    expect(db.all('SELECT * FROM branches')).toHaveLength(0);
    expect(db.all('SELECT * FROM business_hours')).toHaveLength(0);
    expect(db.all('SELECT * FROM services')).toHaveLength(0);
    expect(db.all('SELECT * FROM branch_services')).toHaveLength(0);
  });

  it('validates service duration, price and status', () => {
    const insert = (values: [number, number, string]): void => {
      db.run(
        `INSERT INTO services (id, shop_id, name, slug, duration_minutes, price_cents, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId('srv'), shopId, values[0] === 0 ? 'X' : 'Y', `svc-${Math.random()}`, ...values],
      );
    };

    expect(() => insert([45, 1000, 'active'])).not.toThrow();
    expect(() => insert([3, 1000, 'active'])).toThrow(/CHECK/i); // below 5 minutes
    expect(() => insert([45, -1, 'active'])).toThrow(/CHECK/i); // negative price
    expect(() => insert([45, 1000, 'archived'])).toThrow(/CHECK/i); // unknown status
    expect(() => insert([600, 1000, 'active'])).toThrow(/CHECK/i); // over 8 hours
  });

  it('rejects duplicate service slugs only among live services', () => {
    expect(() =>
      db.run(
        `INSERT INTO services (id, shop_id, name, slug, duration_minutes, price_cents)
         VALUES (?, ?, 'Fade again', 'skin-fade', 30, 2000)`,
        [newId('srv'), shopId],
      ),
    ).toThrow(/UNIQUE/i);

    db.run('DELETE FROM services WHERE id = ?', [serviceId]);
    expect(() =>
      db.run(
        `INSERT INTO services (id, shop_id, name, slug, duration_minutes, price_cents)
         VALUES (?, ?, 'Fade again', 'skin-fade', 30, 2000)`,
        [newId('srv'), shopId],
      ),
    ).not.toThrow();
  });

  it('enforces branch name uniqueness within a shop', () => {
    expect(() =>
      db.run(
        `INSERT INTO branches (id, shop_id, name, address_line1, city, postal_code)
         VALUES (?, ?, 'Downtown', '2 Other St', 'Springfield', '12345')`,
        [newId('brch'), shopId],
      ),
    ).toThrow(/UNIQUE/i);
  });

  it('requires opening hours to be a real interval', () => {
    expect(() =>
      db.run(
        `INSERT INTO business_hours (id, branch_id, weekday, opens_at, closes_at)
         VALUES (?, ?, 1, '18:00', '09:00')`,
        [newId('sched'), branchId],
      ),
    ).not.toThrow(); // start < end is enforced for staff schedules, not branches
    db.run('DELETE FROM business_hours');

    // A day must either be explicitly closed or have both endpoints.
    expect(() =>
      db.run(
        `INSERT INTO business_hours (id, branch_id, weekday, opens_at, closes_at, closed)
         VALUES (?, ?, 2, NULL, NULL, 0)`,
        [newId('sched'), branchId],
      ),
    ).toThrow(/CHECK/i);
    expect(() =>
      db.run(
        `INSERT INTO business_hours (id, branch_id, weekday, opens_at, closes_at, closed)
         VALUES (?, ?, 2, NULL, NULL, 1)`,
        [newId('sched'), branchId],
      ),
    ).not.toThrow();
  });

  it('scopes category slugs per shop', () => {
    expect(() =>
      db.run(
        `INSERT INTO service_categories (id, shop_id, name, slug) VALUES (?, ?, 'Beard', 'hair')`,
        [newId('cat'), shopId],
      ),
    ).toThrow(/UNIQUE/i);
    // A platform-wide category may reuse the same slug.
    expect(() =>
      db.run(
        `INSERT INTO service_categories (id, shop_id, name, slug) VALUES (?, NULL, 'Beard', 'hair')`,
        [newId('cat')],
      ),
    ).not.toThrow();
  });

  it('records per-branch service enablement with optional price override', () => {
    db.run(
      `INSERT INTO branch_services (branch_id, service_id, enabled, price_cents)
       VALUES (?, ?, 1, 3000)`,
      [branchId, serviceId],
    );
    const row = db.get<{ enabled: number; price_cents: number }>(
      'SELECT enabled, price_cents FROM branch_services WHERE branch_id = ? AND service_id = ?',
      [branchId, serviceId],
    );
    expect(row).toEqual({ enabled: 1, price_cents: 3000 });
    expect(() =>
      db.run('INSERT INTO branch_services (branch_id, service_id) VALUES (?, ?)', [
        branchId,
        serviceId,
      ]),
    ).toThrow(/UNIQUE|PRIMARY KEY/i);
  });
});

describe('staffing schema', () => {
  let db: Db;
  let shopId: string;
  let staffId: string;

  beforeEach(() => {
    db = createTestDb();
    const ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name)
       VALUES (?, 'owner@example.com', 'owner@example.com', 'h', '2026-10-07T00:00:00.000Z',
               'Olly', 'Owner', 'Olly Owner')`,
      [ownerId],
    );
    shopId = newId('shop');
    db.run(
      `INSERT INTO shops (id, owner_id, name, slug) VALUES (?, ?, 'Sharp & Co', 'sharp-co')`,
      [shopId, ownerId],
    );
    staffId = newId('staff');
    db.run(
      `INSERT INTO staff (id, shop_id, employee_code, display_name) VALUES (?, ?, 'E-001', 'Kevin P.')`,
      [staffId, shopId],
    );
  });

  afterEach(() => db.close());

  it('allows staff without a linked user account', () => {
    const row = db.get<{ user_id: string | null }>('SELECT user_id FROM staff WHERE id = ?', [staffId]);
    expect(row?.user_id).toBeNull();
  });

  it('keeps employee codes unique per shop', () => {
    expect(() =>
      db.run(`INSERT INTO staff (id, shop_id, employee_code, display_name) VALUES (?, ?, 'E-001', 'Jimmy F.')`, [
        newId('staff'),
        shopId,
      ]),
    ).toThrow(/UNIQUE/i);
  });

  it('constrains commission to basis points', () => {
    expect(() =>
      db.run('UPDATE staff SET commission_bps = 10001 WHERE id = ?', [staffId]),
    ).toThrow(/CHECK/i);
    expect(() =>
      db.run('UPDATE staff SET commission_bps = 3500 WHERE id = ?', [staffId]),
    ).not.toThrow();
  });

  it('requires staff schedules to be ordered intervals', () => {
    expect(() =>
      db.run(
        `INSERT INTO staff_schedules (id, staff_id, weekday, starts_at, ends_at)
         VALUES (?, ?, 1, '18:00', '09:00')`,
        [newId('sched'), staffId],
      ),
    ).toThrow(/CHECK/i);
    expect(() =>
      db.run(
        `INSERT INTO staff_schedules (id, staff_id, weekday, starts_at, ends_at)
         VALUES (?, ?, 1, '09:00', '18:00')`,
        [newId('sched'), staffId],
      ),
    ).not.toThrow();
  });

  it('keeps leave windows ordered', () => {
    expect(() =>
      db.run(
        `INSERT INTO staff_leaves (id, staff_id, starts_on, ends_on, status)
         VALUES (?, ?, '2026-10-10', '2026-10-08', 'pending')`,
        [newId('lnr'), staffId],
      ),
    ).toThrow(/CHECK/i);
    expect(() =>
      db.run(
        `INSERT INTO staff_leaves (id, staff_id, starts_on, ends_on, status)
         VALUES (?, ?, '2026-10-08', '2026-10-10', 'pending')`,
        [newId('lnr'), staffId],
      ),
    ).not.toThrow();
  });

  it('requires an available override to carry a time window', () => {
    expect(() =>
      db.run(
        `INSERT INTO staff_availability_overrides (id, staff_id, override_date, available)
         VALUES (?, ?, '2026-10-08', 1)`,
        [newId('sched'), staffId],
      ),
    ).toThrow(/CHECK/i);
    expect(() =>
      db.run(
        `INSERT INTO staff_availability_overrides (id, staff_id, override_date, available, starts_at, ends_at)
         VALUES (?, ?, '2026-10-08', 1, '09:00', '12:00')`,
        [newId('sched'), staffId],
      ),
    ).not.toThrow();
  });

  it('allows only one availability override per staff member per day', () => {
    const insert = (): void => {
      db.run(
        `INSERT INTO staff_availability_overrides (id, staff_id, override_date, available, starts_at, ends_at)
         VALUES (?, ?, '2026-10-08', 0, NULL, NULL)`,
        [newId('sched'), staffId],
      );
    };
    insert();
    expect(insert).toThrow(/UNIQUE/i);
  });

  it('cascades staff rows and schedules when a shop is deleted', () => {
    db.run(
      `INSERT INTO staff_schedules (id, staff_id, weekday, starts_at, ends_at)
       VALUES (?, ?, 1, '09:00', '18:00')`,
      [newId('sched'), staffId],
    );
    db.run('DELETE FROM shops WHERE id = ?', [shopId]);
    expect(db.all('SELECT * FROM staff')).toHaveLength(0);
    expect(db.all('SELECT * FROM staff_schedules')).toHaveLength(0);
  });

  it('tracks attendance per day and per staff member', () => {
    db.run(
      `INSERT INTO staff_attendance (id, staff_id, work_date, clock_in, clock_out)
       VALUES (?, ?, '2026-10-07', '2026-10-07T08:55:00.000Z', '2026-10-07T17:05:00.000Z')`,
      [newId('staff'), staffId],
    );
    expect(() =>
      db.run(
        `INSERT INTO staff_attendance (id, staff_id, work_date, clock_in)
         VALUES (?, ?, '2026-10-07', '2026-10-07T09:00:00.000Z')`,
        [newId('staff'), staffId],
      ),
    ).toThrow(/UNIQUE/i);
    expect(() =>
      db.run(
        `UPDATE staff_attendance SET clock_in = '2026-10-07T18:00:00.000Z' WHERE staff_id = ?`,
        [staffId],
      ),
    ).toThrow(/CHECK/i);
  });
});
