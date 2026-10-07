import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { BookingsRepository } from './bookings';

describe('BookingsRepository', () => {
  let db: Db;
  let repo: BookingsRepository;
  let shopId: string;
  let branchId: string;
  let customerId: string;
  let staffId: string;
  let serviceId: string;
  let ownerId: string;

  beforeEach(() => {
    db = createTestDb();
    repo = new BookingsRepository(db);

    ownerId = newId('usr');
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
               'John', 'Doe', 'John Doe', 'customer')`,
      [customerId],
    );

    shopId = newId('shop');
    db.run(
      `INSERT INTO shops (id, owner_id, name, slug) VALUES (?, ?, 'Garrison Cuts', 'garrison-cuts')`,
      [shopId, ownerId],
    );

    branchId = newId('brch');
    db.run(
      `INSERT INTO branches (id, shop_id, name, address_line1, city, postal_code)
       VALUES (?, ?, 'Main', '10 Garrison St', 'Birmingham', 'B1 1AA')`,
      [branchId, shopId],
    );

    serviceId = newId('srv');
    db.run(
      `INSERT INTO services (id, shop_id, name, slug, duration_minutes, price_cents)
       VALUES (?, ?, 'Fade & Beard', 'fade-beard', 45, 3500)`,
      [serviceId, shopId],
    );

    staffId = newId('staff');
    db.run(
      `INSERT INTO staff (id, shop_id, employee_code, display_name)
       VALUES (?, ?, 'EMP-01', 'Ada Thorne')`,
      [staffId, shopId],
    );
  });

  afterEach(() => db.close());

  describe('creation and details', () => {
    it('creates an appointment with multi-service items and audit history', () => {
      const apt = repo.create(
        {
          shopId,
          branchId,
          customerId,
          staffId,
          appointmentDate: '2026-10-20',
          startsAt: '2026-10-20T10:00:00.000Z',
          endsAt: '2026-10-20T10:45:00.000Z',
          durationMinutes: 45,
          bufferMinutes: 10,
          totalPriceCents: 3500,
          notes: 'Customer requested skin taper',
        },
        [
          {
            serviceId,
            serviceName: 'Fade & Beard',
            durationMinutes: 45,
            priceCents: 3500,
          },
        ],
      );

      expect(apt.id).toMatch(/^bkd_/);
      expect(apt.status).toBe('confirmed');
      expect(apt.services).toHaveLength(1);
      expect(apt.services[0]!.serviceName).toBe('Fade & Beard');

      const history = repo.getStatusHistory(apt.id);
      expect(history).toHaveLength(1);
      expect(history[0]!.toStatus).toBe('confirmed');
    });
  });

  describe('conflict detection', () => {
    beforeEach(() => {
      // Existing booking from 10:00 to 11:00
      repo.create(
        {
          shopId,
          branchId,
          customerId,
          staffId,
          appointmentDate: '2026-10-20',
          startsAt: '2026-10-20T10:00:00.000Z',
          endsAt: '2026-10-20T11:00:00.000Z',
          durationMinutes: 60,
          totalPriceCents: 4000,
        },
        [],
      );
    });

    it('detects overlapping windows for the same staff member', () => {
      // Exact overlap (10:00 - 11:00)
      expect(
        repo.findConflicts(staffId, '2026-10-20T10:00:00.000Z', '2026-10-20T11:00:00.000Z'),
      ).toHaveLength(1);

      // Overlap on start (09:30 - 10:30)
      expect(
        repo.findConflicts(staffId, '2026-10-20T09:30:00.000Z', '2026-10-20T10:30:00.000Z'),
      ).toHaveLength(1);

      // Overlap on end (10:30 - 11:30)
      expect(
        repo.findConflicts(staffId, '2026-10-20T10:30:00.000Z', '2026-10-20T11:30:00.000Z'),
      ).toHaveLength(1);

      // Inside window (10:15 - 10:45)
      expect(
        repo.findConflicts(staffId, '2026-10-20T10:15:00.000Z', '2026-10-20T10:45:00.000Z'),
      ).toHaveLength(1);

      // Non-overlapping (adjacent end: 11:00 - 12:00)
      expect(
        repo.findConflicts(staffId, '2026-10-20T11:00:00.000Z', '2026-10-20T12:00:00.000Z'),
      ).toHaveLength(0);

      // Non-overlapping (adjacent start: 09:00 - 10:00)
      expect(
        repo.findConflicts(staffId, '2026-10-20T09:00:00.000Z', '2026-10-20T10:00:00.000Z'),
      ).toHaveLength(0);
    });

    it('ignores cancelled bookings during conflict evaluation', () => {
      const conflicts = repo.findConflicts(staffId, '2026-10-20T10:00:00.000Z', '2026-10-20T11:00:00.000Z');
      expect(conflicts).toHaveLength(1);

      repo.cancel(conflicts[0]!.id, 'Customer had an emergency', customerId);

      const afterCancel = repo.findConflicts(staffId, '2026-10-20T10:00:00.000Z', '2026-10-20T11:00:00.000Z');
      expect(afterCancel).toHaveLength(0);
    });
  });

  describe('state transitions and rescheduling', () => {
    it('manages lifecycle from in_progress to completed with audit trail', () => {
      const apt = repo.create(
        {
          shopId,
          branchId,
          customerId,
          staffId,
          appointmentDate: '2026-10-20',
          startsAt: '2026-10-20T14:00:00.000Z',
          endsAt: '2026-10-20T14:45:00.000Z',
          durationMinutes: 45,
          totalPriceCents: 3500,
        },
        [],
      );

      const inProgress = repo.updateStatus(apt.id, 'in_progress', ownerId, 'Client seated');
      expect(inProgress.status).toBe('in_progress');

      const completed = repo.updateStatus(apt.id, 'completed', ownerId, 'Service done');
      expect(completed.status).toBe('completed');

      const history = repo.getStatusHistory(apt.id);
      expect(history).toHaveLength(3);
      expect(history[1]!.toStatus).toBe('in_progress');
      expect(history[2]!.toStatus).toBe('completed');
    });

    it('reschedules appointment time', () => {
      const apt = repo.create(
        {
          shopId,
          branchId,
          customerId,
          staffId,
          appointmentDate: '2026-10-20',
          startsAt: '2026-10-20T14:00:00.000Z',
          endsAt: '2026-10-20T14:45:00.000Z',
          durationMinutes: 45,
          totalPriceCents: 3500,
        },
        [],
      );

      const rescheduled = repo.reschedule(
        apt.id,
        '2026-10-21',
        '2026-10-21T15:00:00.000Z',
        '2026-10-21T15:45:00.000Z',
        customerId,
      );

      expect(rescheduled.appointmentDate).toBe('2026-10-21');
      expect(rescheduled.startsAt).toBe('2026-10-21T15:00:00.000Z');
    });

    it('lists and filters appointments', () => {
      repo.create(
        {
          shopId,
          branchId,
          customerId,
          staffId,
          appointmentDate: '2026-10-20',
          startsAt: '2026-10-20T09:00:00.000Z',
          endsAt: '2026-10-20T09:30:00.000Z',
          durationMinutes: 30,
          totalPriceCents: 2500,
        },
        [],
      );

      const list = repo.list({ customerId, date: '2026-10-20' });
      expect(list).toHaveLength(1);

      const count = repo.count({ staffId });
      expect(count).toBe(1);
    });
  });
});
