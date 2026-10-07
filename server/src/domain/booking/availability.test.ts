import { newId } from '../../core/ids';
import { createTestDb, createTestLogger } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { ShopsRepository } from '../../db/repositories/shops';
import { StaffRepository } from '../../db/repositories/staff';
import { BookingsRepository } from '../../db/repositories/bookings';
import { ServicesRepository } from '../../db/repositories/services';
import { AvailabilityService } from './availability';

describe('AvailabilityService', () => {
  let db: Db;
  let service: AvailabilityService;
  let shopsRepo: ShopsRepository;
  let staffRepo: StaffRepository;
  let bookingsRepo: BookingsRepository;
  let servicesRepo: ServicesRepository;

  let shopId: string;
  let branchId: string;
  let staffId: string;
  let serviceId: string;
  let ownerId: string;
  let customerId: string;

  beforeEach(() => {
    db = createTestDb();
    service = new AvailabilityService({ db, logger: createTestLogger() });
    shopsRepo = new ShopsRepository(db);
    staffRepo = new StaffRepository(db);
    bookingsRepo = new BookingsRepository(db);
    servicesRepo = new ServicesRepository(db);

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
               'Tommy', 'Shelby', 'Tommy Shelby', 'customer')`,
      [customerId],
    );

    const shop = shopsRepo.createShop({
      ownerId,
      name: 'Peaky Barbers',
      slug: 'peaky-barbers',
      status: 'active',
    });
    shopId = shop.id;

    const branch = shopsRepo.createBranch({
      shopId,
      name: 'Central Branch',
      addressLine1: '1 Garrison Lane',
      city: 'Birmingham',
      postalCode: 'B9 4NY',
      status: 'active',
    });
    branchId = branch.id;

    // Branch hours: Monday (weekday 1) 09:00 - 18:00
    shopsRepo.setBusinessHours(branchId, [
      { weekday: 1, opensAt: '09:00', closesAt: '18:00', closed: false },
    ]);

    const srv = servicesRepo.createService({
      shopId,
      name: 'Signature Fade',
      slug: 'signature-fade',
      durationMinutes: 30,
      priceCents: 3000,
    });
    serviceId = srv.id;

    const staff = staffRepo.createStaff({
      shopId,
      employeeCode: 'EMP-01',
      displayName: 'Finn Shelby',
      status: 'active',
      canAcceptBookings: true,
    });
    staffId = staff.id;

    staffRepo.setStaffBranches(staffId, [{ branchId, isPrimary: true }]);
    staffRepo.setStaffServices(staffId, [serviceId]);

    // Staff schedule: Monday (weekday 1) 10:00 - 16:00
    staffRepo.setStaffSchedules(staffId, [
      { weekday: 1, startsAt: '10:00', endsAt: '16:00' },
    ]);

    // Staff break: 12:00 - 13:00
    staffRepo.setStaffBreaks(staffId, [
      { weekday: 1, name: 'Lunch', startsAt: '12:00', endsAt: '13:00' },
    ]);
  });

  afterEach(() => db.close());

  // 2026-10-19 is a Monday (weekday 1)
  const testMonday = '2026-10-19';
  const pastReferenceTime = new Date('2026-10-19T00:00:00.000Z');

  it('computes open slots respecting staff shift and daily break', () => {
    const slots = service.getAvailableSlots({
      branchId,
      staffId,
      date: testMonday,
      durationMinutes: 30,
      slotIntervalMinutes: 30,
      now: pastReferenceTime,
    });

    // Working window: 10:00 to 16:00 (6 hours = 12 half-hour slots)
    // Minus lunch 12:00 to 13:00 (2 half-hour slots: 12:00 and 12:30)
    // Expected: 10 slots
    const times = slots.map((s) => s.timeLabel);
    expect(times).toContain('10:00');
    expect(times).toContain('11:30');
    expect(times).not.toContain('12:00');
    expect(times).not.toContain('12:30');
    expect(times).toContain('13:00');
    expect(times).toContain('15:30');
    expect(times).not.toContain('16:00'); // At 16:00 shift ends, duration 30 would finish at 16:30
    expect(slots).toHaveLength(10);
  });

  it('excludes slots overlapping with existing bookings including buffer time', () => {
    // Existing booking from 10:00 to 10:30 with 15 min buffer (blocks up to 10:45)
    bookingsRepo.create(
      {
        shopId,
        branchId,
        customerId,
        staffId,
        appointmentDate: testMonday,
        startsAt: '2026-10-19T10:00:00.000Z',
        endsAt: '2026-10-19T10:30:00.000Z',
        durationMinutes: 30,
        bufferMinutes: 15,
        totalPriceCents: 3000,
      },
      [],
    );

    const slots = service.getAvailableSlots({
      branchId,
      staffId,
      date: testMonday,
      durationMinutes: 30,
      slotIntervalMinutes: 15,
      now: pastReferenceTime,
    });

    const times = slots.map((s) => s.timeLabel);
    // 10:00, 10:15, 10:30 are blocked because booking + buffer occupies 10:00 to 10:45
    expect(times).not.toContain('10:00');
    expect(times).not.toContain('10:15');
    expect(times).not.toContain('10:30');
    expect(times).toContain('10:45');
  });

  it('returns empty when branch is closed on that day or on holiday', () => {
    // Sunday (2026-10-18) has no business hours configured
    const sundaySlots = service.getAvailableSlots({
      branchId,
      staffId,
      date: '2026-10-18',
      durationMinutes: 30,
      now: pastReferenceTime,
    });
    expect(sundaySlots).toHaveLength(0);

    // Add holiday on testMonday
    shopsRepo.addHoliday({
      branchId,
      holidayDate: testMonday,
      name: 'Bank Holiday',
    });

    const holidaySlots = service.getAvailableSlots({
      branchId,
      staffId,
      date: testMonday,
      durationMinutes: 30,
      now: pastReferenceTime,
    });
    expect(holidaySlots).toHaveLength(0);
  });

  it('returns empty when staff is on approved leave', () => {
    staffRepo.requestLeave({
      id: 'leave_1',
      staffId,
      startsOn: testMonday,
      endsOn: testMonday,
      reason: 'Sick leave',
    });
    staffRepo.decideLeave('leave_1', 'approved', ownerId);

    const slots = service.getAvailableSlots({
      branchId,
      staffId,
      date: testMonday,
      durationMinutes: 30,
      now: pastReferenceTime,
    });
    expect(slots).toHaveLength(0);
  });

  it('respects day availability overrides', () => {
    // Override date with custom short shift: 13:00 - 15:00
    staffRepo.setAvailabilityOverride({
      staffId,
      overrideDate: testMonday,
      available: true,
      startsAt: '13:00',
      endsAt: '15:00',
    });

    const slots = service.getAvailableSlots({
      branchId,
      staffId,
      date: testMonday,
      durationMinutes: 30,
      slotIntervalMinutes: 30,
      now: pastReferenceTime,
    });

    const times = slots.map((s) => s.timeLabel);
    expect(times).toEqual(['13:00', '13:30', '14:00', '14:30']);
  });

  it('retrieves active qualified staff for a service at branch', () => {
    const staffList = service.getStaffForService(branchId, serviceId);
    expect(staffList).toHaveLength(1);
    expect(staffList[0]!.id).toBe(staffId);
  });
});
