import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { ServicesRepository } from './services';
import { ShopsRepository } from './shops';
import { StaffRepository } from './staff';

describe('StaffRepository', () => {
  let db: Db;
  let staffRepo: StaffRepository;
  let shopsRepo: ShopsRepository;
  let servicesRepo: ServicesRepository;
  let ownerId: string;
  let shopId: string;
  let branchId: string;
  let serviceId: string;

  beforeEach(() => {
    db = createTestDb();
    staffRepo = new StaffRepository(db);
    shopsRepo = new ShopsRepository(db);
    servicesRepo = new ServicesRepository(db);

    ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@sharp.com', 'owner@sharp.com', 'scrypt_hash', '2026-10-07T00:00:00.000Z',
               'Arthur', 'Shelby', 'Arthur Shelby', 'owner')`,
      [ownerId],
    );

    const shop = shopsRepo.createShop({ ownerId, name: 'Sharp Cuts', slug: 'sharp-cuts', status: 'active' });
    shopId = shop.id;

    const branch = shopsRepo.createBranch({
      shopId,
      name: 'Main Branch',
      addressLine1: '100 Main St',
      city: 'Boston',
      postalCode: '02108',
    });
    branchId = branch.id;

    const service = servicesRepo.createService({
      shopId,
      name: 'Beard Trim',
      slug: 'beard-trim',
      durationMinutes: 20,
      priceCents: 2000,
    });
    serviceId = service.id;
  });

  afterEach(() => db.close());

  describe('staff profiles', () => {
    it('creates, updates and retrieves staff profiles', () => {
      const staff = staffRepo.createStaff({
        shopId,
        employeeCode: 'EMP-001',
        displayName: 'John Barber',
        title: 'Senior Stylist',
        commissionBps: 2500, // 25%
        employment: 'full_time',
      });

      expect(staff.id).toMatch(/^staff_/);
      expect(staff.employeeCode).toBe('EMP-001');
      expect(staff.commissionBps).toBe(2500);
      expect(staff.canAcceptBookings).toBe(true);

      const byCode = staffRepo.findStaffByCode(shopId, 'EMP-001');
      expect(byCode).toEqual(staff);

      const updated = staffRepo.updateStaff(staff.id, {
        bio: 'Master barber with 10 years experience',
        commissionBps: 3000,
      });
      expect(updated.bio).toBe('Master barber with 10 years experience');
      expect(updated.commissionBps).toBe(3000);

      const withRating = staffRepo.updateRating(staff.id, 4.9, 120);
      expect(withRating.ratingAvg).toBe(4.9);
      expect(withRating.ratingCount).toBe(120);

      staffRepo.softDeleteStaff(staff.id);
      expect(staffRepo.findStaffById(staff.id)).toBeNull();
      expect(staffRepo.findStaffById(staff.id, { includeDeleted: true })?.deletedAt).not.toBeNull();
    });

    it('filters staff by branch and service capability', () => {
      const s1 = staffRepo.createStaff({
        shopId,
        employeeCode: 'EMP-01',
        displayName: 'Alice',
      });
      const s2 = staffRepo.createStaff({
        shopId,
        employeeCode: 'EMP-02',
        displayName: 'Bob',
      });

      staffRepo.setStaffBranches(s1.id, [{ branchId, isPrimary: true }]);
      staffRepo.setStaffServices(s1.id, [serviceId]);

      const atBranch = staffRepo.listStaff({ shopId, branchId });
      expect(atBranch).toHaveLength(1);
      expect(atBranch[0]!.id).toBe(s1.id);

      const withSkill = staffRepo.listStaff({ shopId, serviceId });
      expect(withSkill).toHaveLength(1);
      expect(withSkill[0]!.id).toBe(s1.id);
    });
  });

  describe('schedules and breaks', () => {
    it('manages recurring weekly schedules and daily breaks', () => {
      const staff = staffRepo.createStaff({
        shopId,
        employeeCode: 'EMP-03',
        displayName: 'Charlie',
      });

      const schedules = staffRepo.setStaffSchedules(staff.id, [
        { weekday: 1, startsAt: '09:00', endsAt: '17:00' },
        { weekday: 2, startsAt: '09:00', endsAt: '17:00' },
      ]);
      expect(schedules).toHaveLength(2);
      expect(schedules[0]!.startsAt).toBe('09:00');

      const breaks = staffRepo.setStaffBreaks(staff.id, [
        { weekday: 1, name: 'Lunch', startsAt: '12:00', endsAt: '13:00' },
      ]);
      expect(breaks).toHaveLength(1);
      expect(breaks[0]!.name).toBe('Lunch');
    });
  });

  describe('leaves, overrides, and attendance', () => {
    it('tracks leave requests through approval workflow', () => {
      const staff = staffRepo.createStaff({
        shopId,
        employeeCode: 'EMP-04',
        displayName: 'David',
      });

      const leave = staffRepo.requestLeave({
        staffId: staff.id,
        startsOn: '2026-11-01',
        endsOn: '2026-11-05',
        reason: 'Annual vacation',
      });
      expect(leave.status).toBe('pending');

      const approved = staffRepo.decideLeave(leave.id, 'approved', ownerId);
      expect(approved.status).toBe('approved');
      expect(approved.decidedBy).toBe(ownerId);

      const leaves = staffRepo.listLeaves(staff.id, { status: 'approved' });
      expect(leaves).toHaveLength(1);
    });

    it('sets day availability overrides', () => {
      const staff = staffRepo.createStaff({
        shopId,
        employeeCode: 'EMP-05',
        displayName: 'Eva',
      });

      const override = staffRepo.setAvailabilityOverride({
        staffId: staff.id,
        overrideDate: '2026-11-10',
        available: false,
        reason: 'Emergency dental appointment',
      });

      expect(override.available).toBe(false);

      const fetched = staffRepo.getOverrideForDate(staff.id, '2026-11-10');
      expect(fetched?.reason).toBe('Emergency dental appointment');
    });

    it('records attendance punches and updates records idempotently', () => {
      const staff = staffRepo.createStaff({
        shopId,
        employeeCode: 'EMP-06',
        displayName: 'Frank',
      });

      const att = staffRepo.recordAttendance({
        staffId: staff.id,
        workDate: '2026-10-07',
        clockIn: '08:55',
        status: 'present',
      });
      expect(att.clockIn).toBe('08:55');
      expect(att.clockOut).toBeNull();

      const clockedOut = staffRepo.recordAttendance({
        staffId: staff.id,
        workDate: '2026-10-07',
        clockOut: '17:05',
        notes: 'Shift completed cleanly',
      });
      expect(clockedOut.clockIn).toBe('08:55');
      expect(clockedOut.clockOut).toBe('17:05');
      expect(clockedOut.notes).toBe('Shift completed cleanly');
    });
  });
});
