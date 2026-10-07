import { createTestDb } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { StaffLeavesService } from './staffLeaves';
import { BookingsRepository } from '../../db/repositories/bookings';
import { UsersRepository } from '../../db/repositories/users';
import { ShopsRepository } from '../../db/repositories/shops';
import { StaffRepository } from '../../db/repositories/staff';
import { ServicesRepository } from '../../db/repositories/services';
import { newId } from '../../core/ids';

/** Build a complete harness: user → shop → branch → service → staff member */
function buildHarness(db: Db) {
  const users = new UsersRepository(db);
  const shops = new ShopsRepository(db);
  const staff = new StaffRepository(db);
  const services = new ServicesRepository(db);
  const bookings = new BookingsRepository(db);

  const ownerId = newId('usr');
  users.insert({
    id: ownerId,
    email: `owner-${ownerId}@example.com`,
    passwordHash: 'hash',
    firstName: 'Owner',
    lastName: 'Test',
    role: 'owner',
  });

  const staffUserId = newId('usr');
  users.insert({
    id: staffUserId,
    email: `barber-${staffUserId}@example.com`,
    passwordHash: 'hash',
    firstName: 'Barber',
    lastName: 'Test',
    role: 'barber',
  });

  const managerId = newId('usr');
  users.insert({
    id: managerId,
    email: `mgr-${managerId}@example.com`,
    passwordHash: 'hash',
    firstName: 'Manager',
    lastName: 'Test',
    role: 'manager',
  });

  const shop = shops.createShop({
    id: newId('shop'),
    ownerId,
    name: 'Leave Test Shop',
    slug: `leave-shop-${Date.now()}`,
    currency: 'USD',
  });

  const branch = shops.createBranch({
    shopId: shop.id,
    name: 'Main',
    addressLine1: '1 Main St',
    city: 'LA',
    postalCode: '90001',
    status: 'active',
  });

  const service = services.createService({
    shopId: shop.id,
    name: 'Haircut',
    slug: `haircut-${Date.now()}`,
    durationMinutes: 30,
    priceCents: 2500,
  });

  const staffMember = staff.createStaff({
    shopId: shop.id,
    userId: staffUserId,
    displayName: 'Joe Barber',
    employeeCode: 'EMP-01',
    status: 'active',
  });

  const leavesService = new StaffLeavesService(db, bookings);

  return { ownerId, staffUserId, managerId, shop, branch, service, staffMember, bookings, leavesService, users };
}

describe('StaffLeavesService', () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it('creates a leave request in pending status', () => {
    const { staffMember, leavesService } = buildHarness(db);

    const leave = leavesService.requestLeave({
      staffId: staffMember.id,
      leaveType: 'vacation',
      startDate: '2026-12-24',
      endDate: '2026-12-31',
      reason: 'Holiday travel',
    });

    expect(leave.id).toMatch(/^lve_/);
    expect(leave.status).toBe('pending');
    expect(leave.leaveType).toBe('vacation');
    expect(leave.startDate).toBe('2026-12-24');
    expect(leave.endDate).toBe('2026-12-31');
    expect(leave.reason).toBe('Holiday travel');
  });

  it('rejects a leave request where end date is before start date', () => {
    const { staffMember, leavesService } = buildHarness(db);

    expect(() =>
      leavesService.requestLeave({
        staffId: staffMember.id,
        leaveType: 'sick',
        startDate: '2026-11-10',
        endDate: '2026-11-09',
      }),
    ).toThrow('Leave end date must be on or after start date');
  });

  it('prevents overlapping leave requests', () => {
    const { staffMember, leavesService } = buildHarness(db);

    leavesService.requestLeave({
      staffId: staffMember.id,
      leaveType: 'vacation',
      startDate: '2026-12-20',
      endDate: '2026-12-28',
    });

    expect(() =>
      leavesService.requestLeave({
        staffId: staffMember.id,
        leaveType: 'sick',
        startDate: '2026-12-25',
        endDate: '2026-12-30',
      }),
    ).toThrow(/overlaps/i);
  });

  it('approves a leave when no booking conflicts exist', () => {
    const { staffMember, managerId, leavesService } = buildHarness(db);

    const leave = leavesService.requestLeave({
      staffId: staffMember.id,
      leaveType: 'vacation',
      startDate: '2027-01-10',
      endDate: '2027-01-15',
    });

    const approved = leavesService.approveLeave({
      leaveId: leave.id,
      reviewedByUserId: managerId,
    });

    expect(approved.status).toBe('approved');
    expect(approved.reviewedBy).toBe(managerId);
    expect(approved.reviewedAt).not.toBeNull();
  });

  it('blocks approval when staff has confirmed bookings during leave period', () => {
    const { staffMember, managerId, branch, service, leavesService, bookings, users } = buildHarness(db);

    const customerId = newId('usr');
    users.insert({
      id: customerId,
      email: `customer-${customerId}@example.com`,
      passwordHash: 'hash',
      firstName: 'Customer',
      lastName: 'Test',
      role: 'customer',
    });

    // Create a confirmed booking on the leave date
    bookings.create(
      {
        id: newId('bkd'),
        shopId: staffMember.shopId,
        branchId: branch.id,
        customerId,
        staffId: staffMember.id,
        status: 'confirmed',
        appointmentDate: '2027-02-12',
        startsAt: '2027-02-12T10:00:00.000Z',
        endsAt: '2027-02-12T10:30:00.000Z',
        durationMinutes: 30,
        bufferMinutes: 0,
        totalPriceCents: 2500,
        currency: 'USD',
      },
      [
        {
          serviceId: service.id,
          serviceName: service.name,
          durationMinutes: service.durationMinutes,
          priceCents: service.priceCents,
        },
      ],
    );

    const leave = leavesService.requestLeave({
      staffId: staffMember.id,
      leaveType: 'sick',
      startDate: '2027-02-10',
      endDate: '2027-02-14',
    });

    expect(() =>
      leavesService.approveLeave({ leaveId: leave.id, reviewedByUserId: managerId }),
    ).toThrow(/appointment/i);
  });

  it('rejects a pending leave request with a reason', () => {
    const { staffMember, managerId, leavesService } = buildHarness(db);

    const leave = leavesService.requestLeave({
      staffId: staffMember.id,
      leaveType: 'personal',
      startDate: '2027-03-01',
      endDate: '2027-03-03',
    });

    const rejected = leavesService.rejectLeave({
      leaveId: leave.id,
      reviewedByUserId: managerId,
      rejectReason: 'Busy season — insufficient coverage',
    });

    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectReason).toBe('Busy season — insufficient coverage');
  });

  it('allows staff to cancel their own pending leave', () => {
    const { staffMember, leavesService } = buildHarness(db);

    const leave = leavesService.requestLeave({
      staffId: staffMember.id,
      leaveType: 'personal',
      startDate: '2027-04-01',
      endDate: '2027-04-02',
    });

    const cancelled = leavesService.cancelLeave(leave.id, staffMember.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('isOnLeave returns true for an approved leave covering the date', () => {
    const { staffMember, managerId, leavesService } = buildHarness(db);

    const leave = leavesService.requestLeave({
      staffId: staffMember.id,
      leaveType: 'vacation',
      startDate: '2027-05-01',
      endDate: '2027-05-07',
    });

    leavesService.approveLeave({ leaveId: leave.id, reviewedByUserId: managerId });

    expect(leavesService.isOnLeave(staffMember.id, '2027-05-04')).toBe(true);
    expect(leavesService.isOnLeave(staffMember.id, '2027-05-08')).toBe(false);
  });
});
