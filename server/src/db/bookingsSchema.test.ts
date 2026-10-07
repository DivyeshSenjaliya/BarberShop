import { newId } from '../core/ids';
import { createTestDb } from '../test-support/db';
import type { Db } from './sqlite';

describe('bookings schema (migration 004)', () => {
  let db: Db;
  let shopId: string;
  let branchId: string;
  let customerId: string;
  let staffId: string;
  let serviceId: string;

  beforeEach(() => {
    db = createTestDb();

    const ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@shop.com', 'owner@shop.com', 'h', '2026-10-07T00:00:00.000Z',
               'Arthur', 'Shelby', 'Arthur Shelby', 'owner')`,
      [ownerId],
    );

    customerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'cust@gmail.com', 'cust@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Tommy', 'Shelby', 'Tommy Shelby', 'customer')`,
      [customerId],
    );

    shopId = newId('shop');
    db.run(
      `INSERT INTO shops (id, owner_id, name, slug) VALUES (?, ?, 'Shelby Cuts', 'shelby-cuts')`,
      [shopId, ownerId],
    );

    branchId = newId('brch');
    db.run(
      `INSERT INTO branches (id, shop_id, name, address_line1, city, postal_code)
       VALUES (?, ?, 'Small Heath', 'Garrison Lane', 'Birmingham', 'B9 4NY')`,
      [branchId, shopId],
    );

    serviceId = newId('srv');
    db.run(
      `INSERT INTO services (id, shop_id, name, slug, duration_minutes, price_cents)
       VALUES (?, ?, 'Peak Haircut', 'peak-haircut', 30, 2500)`,
      [serviceId, shopId],
    );

    staffId = newId('staff');
    db.run(
      `INSERT INTO staff (id, shop_id, employee_code, display_name)
       VALUES (?, ?, 'EMP-01', 'Finn Shelby')`,
      [staffId, shopId],
    );
  });

  afterEach(() => db.close());

  it('inserts valid appointment and service items', () => {
    const aptId = newId('bkd');
    db.run(
      `INSERT INTO appointments (
         id, shop_id, branch_id, customer_id, staff_id, status, appointment_date,
         starts_at, ends_at, duration_minutes, buffer_minutes, total_price_cents
       ) VALUES (?, ?, ?, ?, ?, 'confirmed', '2026-10-15',
                 '2026-10-15T10:00:00.000Z', '2026-10-15T10:30:00.000Z', 30, 10, 2500)`,
      [aptId, shopId, branchId, customerId, staffId],
    );

    db.run(
      `INSERT INTO appointment_services (id, appointment_id, service_id, service_name, duration_minutes, price_cents)
       VALUES (?, ?, ?, 'Peak Haircut', 30, 2500)`,
      [newId('srv'), aptId, serviceId],
    );

    const apt = db.get<{ id: string; status: string }>('SELECT id, status FROM appointments WHERE id = ?', [aptId]);
    expect(apt?.id).toBe(aptId);
    expect(apt?.status).toBe('confirmed');

    const items = db.all<{ id: string }>('SELECT id FROM appointment_services WHERE appointment_id = ?', [aptId]);
    expect(items).toHaveLength(1);
  });

  it('rejects appointments where starts_at >= ends_at', () => {
    const aptId = newId('bkd');
    expect(() =>
      db.run(
        `INSERT INTO appointments (
           id, shop_id, branch_id, customer_id, staff_id, status, appointment_date,
           starts_at, ends_at, duration_minutes, total_price_cents
         ) VALUES (?, ?, ?, ?, ?, 'confirmed', '2026-10-15',
                   '2026-10-15T11:00:00.000Z', '2026-10-15T10:00:00.000Z', 30, 2500)`,
        [aptId, shopId, branchId, customerId, staffId],
      ),
    ).toThrow(/CHECK constraint failed/i);
  });

  it('rejects invalid status values', () => {
    const aptId = newId('bkd');
    expect(() =>
      db.run(
        `INSERT INTO appointments (
           id, shop_id, branch_id, customer_id, staff_id, status, appointment_date,
           starts_at, ends_at, duration_minutes, total_price_cents
         ) VALUES (?, ?, ?, ?, ?, 'not_a_real_status', '2026-10-15',
                   '2026-10-15T10:00:00.000Z', '2026-10-15T10:30:00.000Z', 30, 2500)`,
        [aptId, shopId, branchId, customerId, staffId],
      ),
    ).toThrow(/CHECK constraint failed/i);
  });

  it('cascades deletion to appointment_services and status history', () => {
    const aptId = newId('bkd');
    db.run(
      `INSERT INTO appointments (
         id, shop_id, branch_id, customer_id, staff_id, status, appointment_date,
         starts_at, ends_at, duration_minutes, total_price_cents
       ) VALUES (?, ?, ?, ?, ?, 'confirmed', '2026-10-15',
                 '2026-10-15T10:00:00.000Z', '2026-10-15T10:30:00.000Z', 30, 2500)`,
      [aptId, shopId, branchId, customerId, staffId],
    );

    db.run(
      `INSERT INTO appointment_services (id, appointment_id, service_id, service_name, duration_minutes, price_cents)
       VALUES (?, ?, ?, 'Peak Haircut', 30, 2500)`,
      [newId('srv'), aptId, serviceId],
    );

    db.run(
      `INSERT INTO appointment_status_history (id, appointment_id, from_status, to_status)
       VALUES (?, ?, 'pending', 'confirmed')`,
      [newId('req'), aptId],
    );

    // Delete appointment
    db.run('DELETE FROM appointments WHERE id = ?', [aptId]);

    const services = db.all('SELECT id FROM appointment_services WHERE appointment_id = ?', [aptId]);
    expect(services).toHaveLength(0);

    const history = db.all('SELECT id FROM appointment_status_history WHERE appointment_id = ?', [aptId]);
    expect(history).toHaveLength(0);
  });
});
