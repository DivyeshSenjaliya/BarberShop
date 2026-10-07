import { newId } from '../../core/ids';
import { createTestDb, createTestLogger } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { ShopsRepository } from '../../db/repositories/shops';
import { StaffRepository } from '../../db/repositories/staff';
import { ServicesRepository } from '../../db/repositories/services';
import { BookingsService, type Actor } from './service';

describe('BookingsService', () => {
  let db: Db;
  let service: BookingsService;
  let shopsRepo: ShopsRepository;
  let staffRepo: StaffRepository;
  let servicesRepo: ServicesRepository;

  let shopId: string;
  let branchId: string;
  let staffId: string;
  let srvHaircutId: string;
  let srvBeardId: string;
  let ownerActor: Actor;
  let customerActor: Actor;

  // 2026-10-19 is a Monday
  const testMonday = '2026-10-19';

  beforeEach(() => {
    db = createTestDb();
    service = new BookingsService({ db, logger: createTestLogger() });
    shopsRepo = new ShopsRepository(db);
    staffRepo = new StaffRepository(db);
    servicesRepo = new ServicesRepository(db);

    const ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@shop.com', 'owner@shop.com', 'h', '2026-10-07T00:00:00.000Z',
               'Arthur', 'Shelby', 'Arthur Shelby', 'owner')`,
      [ownerId],
    );
    ownerActor = { userId: ownerId, role: 'owner' };

    const customerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'cust@gmail.com', 'cust@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Tommy', 'Shelby', 'Tommy Shelby', 'customer')`,
      [customerId],
    );
    customerActor = { userId: customerId, role: 'customer' };

    const shop = shopsRepo.createShop({
      ownerId,
      name: 'Peaky Barbers',
      slug: 'peaky-barbers',
      status: 'active',
    });
    shopId = shop.id;

    const branch = shopsRepo.createBranch({
      shopId,
      name: 'Main Lounge',
      addressLine1: '1 Garrison St',
      city: 'Birmingham',
      postalCode: 'B9 4NY',
      status: 'active',
    });
    branchId = branch.id;

    // Monday 09:00 - 18:00
    shopsRepo.setBusinessHours(branchId, [
      { weekday: 1, opensAt: '09:00', closesAt: '18:00', closed: false },
    ]);

    const s1 = servicesRepo.createService({
      shopId,
      name: 'Signature Haircut',
      slug: 'signature-haircut',
      durationMinutes: 30,
      priceCents: 3000,
    });
    srvHaircutId = s1.id;

    const s2 = servicesRepo.createService({
      shopId,
      name: 'Hot Towel Beard Trim',
      slug: 'beard-trim',
      durationMinutes: 20,
      priceCents: 2000,
    });
    srvBeardId = s2.id;

    const staff = staffRepo.createStaff({
      shopId,
      employeeCode: 'EMP-01',
      displayName: 'Finn Shelby',
      status: 'active',
      canAcceptBookings: true,
    });
    staffId = staff.id;

    staffRepo.setStaffBranches(staffId, [{ branchId, isPrimary: true }]);
    staffRepo.setStaffServices(staffId, [srvHaircutId, srvBeardId]);

    // Monday 10:00 - 17:00
    staffRepo.setStaffSchedules(staffId, [
      { weekday: 1, startsAt: '10:00', endsAt: '17:00' },
    ]);
  });

  afterEach(() => db.close());

  describe('booking creation', () => {
    it('creates multi-service booking with combined price and duration', () => {
      const apt = service.createBooking(customerActor, {
        branchId,
        staffId,
        serviceIds: [srvHaircutId, srvBeardId],
        startsAt: `${testMonday}T10:00:00.000Z`,
        notes: 'First time visitor',
      });

      expect(apt.id).toMatch(/^bkd_/);
      expect(apt.status).toBe('confirmed');
      expect(apt.durationMinutes).toBe(50); // 30 + 20
      expect(apt.totalPriceCents).toBe(5000); // 3000 + 2000
      expect(apt.endsAt).toBe(`${testMonday}T10:50:00.000Z`);
      expect(apt.services).toHaveLength(2);
    });

    it('rejects double booking at overlapping times', () => {
      // First booking 10:00 - 10:30
      service.createBooking(customerActor, {
        branchId,
        staffId,
        serviceIds: [srvHaircutId],
        startsAt: `${testMonday}T10:00:00.000Z`,
      });

      // Second booking at 10:00 should fail
      expect(() =>
        service.createBooking(customerActor, {
          branchId,
          staffId,
          serviceIds: [srvHaircutId],
          startsAt: `${testMonday}T10:00:00.000Z`,
        }),
      ).toThrow(/not available/i);
    });

    it('rejects booking if staff lacks skill for selected service', () => {
      const unskilledService = servicesRepo.createService({
        shopId,
        name: 'Hair Coloring',
        slug: 'hair-coloring',
        durationMinutes: 60,
        priceCents: 8000,
      });

      expect(() =>
        service.createBooking(customerActor, {
          branchId,
          staffId,
          serviceIds: [unskilledService.id],
          startsAt: `${testMonday}T10:00:00.000Z`,
        }),
      ).toThrow(/cannot perform service/i);
    });
  });

  describe('status transitions and cancellation', () => {
    it('enforces status transition state machine', () => {
      const apt = service.createBooking(customerActor, {
        branchId,
        staffId,
        serviceIds: [srvHaircutId],
        startsAt: `${testMonday}T10:00:00.000Z`,
      });

      const inProgress = service.updateAppointmentStatus(ownerActor, apt.id, 'in_progress');
      expect(inProgress.status).toBe('in_progress');

      const completed = service.updateAppointmentStatus(ownerActor, apt.id, 'completed');
      expect(completed.status).toBe('completed');

      // Cannot transition from completed back to in_progress
      expect(() =>
        service.updateAppointmentStatus(ownerActor, apt.id, 'in_progress'),
      ).toThrow(/Cannot transition appointment from status 'completed'/i);
    });

    it('cancels booking with reason', () => {
      const apt = service.createBooking(customerActor, {
        branchId,
        staffId,
        serviceIds: [srvHaircutId],
        startsAt: `${testMonday}T10:00:00.000Z`,
      });

      const cancelled = service.cancelBooking(customerActor, apt.id, 'Change of plans');
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancellationReason).toBe('Change of plans');
    });

    it('reschedules booking to a new available slot', () => {
      const futureDate = '2028-10-19'; // Assuming future Monday
      // Configure Monday hours for branch & staff
      const apt = service.createBooking(customerActor, {
        branchId,
        staffId,
        serviceIds: [srvHaircutId],
        startsAt: `${testMonday}T10:00:00.000Z`,
      });

      const rescheduled = service.rescheduleBooking(customerActor, apt.id, {
        newStartsAt: `${testMonday}T11:00:00.000Z`,
        reason: 'Running an hour late',
      });

      expect(rescheduled.startsAt).toBe(`${testMonday}T11:00:00.000Z`);
      expect(rescheduled.endsAt).toBe(`${testMonday}T11:30:00.000Z`);
    });
  });
});
