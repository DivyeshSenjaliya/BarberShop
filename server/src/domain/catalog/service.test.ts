import { newId } from '../../core/ids';
import { createTestDb, createTestLogger } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { CatalogService, type Actor } from './service';

describe('CatalogService', () => {
  let db: Db;
  let service: CatalogService;
  let ownerActor: Actor;
  let customerActor: Actor;
  let otherOwnerActor: Actor;

  beforeEach(() => {
    db = createTestDb();
    service = new CatalogService({ db, logger: createTestLogger() });

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
               'Thomas', 'Shelby', 'Thomas Shelby', 'customer')`,
      [customerId],
    );
    customerActor = { userId: customerId, role: 'customer' };

    const otherId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'other@shop.com', 'other@shop.com', 'h', '2026-10-07T00:00:00.000Z',
               'John', 'Boy', 'John Boy', 'owner')`,
      [otherId],
    );
    otherOwnerActor = { userId: otherId, role: 'owner' };
  });

  afterEach(() => db.close());

  describe('shops and branches', () => {
    it('allows owners to create shops, denies customers', () => {
      expect(() =>
        service.createShop(customerActor, {
          name: 'Forbidden Cuts',
          slug: 'forbidden-cuts',
        }),
      ).toThrow(/cannot perform 'shop:write'/i);

      const shop = service.createShop(ownerActor, {
        name: 'The Garrison Grooming',
        slug: 'garrison-grooming',
      });
      expect(shop.id).toMatch(/^shop_/);
      expect(shop.ownerId).toBe(ownerActor.userId);

      // Prevents duplicate slug
      expect(() =>
        service.createShop(ownerActor, {
          name: 'Another Shop',
          slug: 'garrison-grooming',
        }),
      ).toThrow(/already exists/i);
    });

    it('enforces ownership checks on updates', () => {
      const shop = service.createShop(ownerActor, {
        name: 'My Barbershop',
        slug: 'my-barbershop',
      });

      expect(() =>
        service.updateShop(otherOwnerActor, shop.id, {
          name: 'Hacked Shop',
        }),
      ).toThrow(/permission/i);

      const updated = service.updateShop(ownerActor, shop.id, {
        name: 'Renamed Barbershop',
      });
      expect(updated.name).toBe('Renamed Barbershop');
    });

    it('creates branches and validates business hours', () => {
      const shop = service.createShop(ownerActor, {
        name: 'Blade & Brush',
        slug: 'blade-brush',
      });

      const branch = service.createBranch(ownerActor, shop.id, {
        name: 'Downtown',
        addressLine1: '100 Water St',
        city: 'New York',
        postalCode: '10005',
      });
      expect(branch.id).toMatch(/^brch_/);

      // Valid hours
      const hours = service.setBusinessHours(ownerActor, branch.id, [
        { weekday: 1, opensAt: '09:00', closesAt: '17:00' },
      ]);
      expect(hours).toHaveLength(1);

      // Invalid hours: opensAt >= closesAt
      expect(() =>
        service.setBusinessHours(ownerActor, branch.id, [
          { weekday: 2, opensAt: '18:00', closesAt: '09:00' },
        ]),
      ).toThrow(/opensAt must be before closesAt/i);
    });
  });

  describe('services and staff', () => {
    it('manages services, branch overrides, and staff scheduling', () => {
      const shop = service.createShop(ownerActor, {
        name: 'Crown Barbers',
        slug: 'crown-barbers',
      });

      const branch = service.createBranch(ownerActor, shop.id, {
        name: 'Central',
        addressLine1: '50 Main St',
        city: 'Chicago',
        postalCode: '60601',
      });

      const cat = service.createCategory(ownerActor, {
        shopId: shop.id,
        name: 'Shaves',
        slug: 'shaves',
      });

      const srv = service.createService(ownerActor, shop.id, {
        categoryId: cat.id,
        name: 'Royal Shave',
        slug: 'royal-shave',
        durationMinutes: 40,
        priceCents: 4500,
      });
      expect(srv.priceCents).toBe(4500);

      // Override price at branch
      service.configureBranchService(ownerActor, branch.id, srv.id, {
        priceCents: 5000,
      });

      const branchServices = service.listBranchServices(branch.id);
      expect(branchServices[0]!.effectivePriceCents).toBe(5000);

      // Add staff member
      const staff = service.createStaff(ownerActor, shop.id, {
        employeeCode: 'EMP-101',
        displayName: 'Michael',
      });

      service.setStaffServices(ownerActor, staff.id, [srv.id]);
      expect(service.getStaffServices(staff.id)).toEqual([srv.id]);

      // Set schedule
      const sched = service.setStaffSchedules(ownerActor, staff.id, [
        { weekday: 1, startsAt: '10:00', endsAt: '18:00' },
      ]);
      expect(sched).toHaveLength(1);

      // Leave request & approval
      const leave = service.requestLeave(staff.id, {
        startsOn: '2026-12-01',
        endsOn: '2026-12-02',
        reason: 'Rest',
      });
      expect(leave.status).toBe('pending');

      const approved = service.decideLeave(ownerActor, leave.id, 'approved');
      expect(approved.status).toBe('approved');
    });
  });
});
