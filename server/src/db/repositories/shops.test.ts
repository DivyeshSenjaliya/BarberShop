import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { ShopsRepository } from './shops';

describe('ShopsRepository', () => {
  let db: Db;
  let repo: ShopsRepository;
  let ownerId: string;

  beforeEach(() => {
    db = createTestDb();
    repo = new ShopsRepository(db);

    ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@sharp.com', 'owner@sharp.com', 'scrypt_hash', '2026-10-07T00:00:00.000Z',
               'Arthur', 'Shelby', 'Arthur Shelby', 'owner')`,
      [ownerId],
    );
  });

  afterEach(() => db.close());

  describe('shops', () => {
    it('creates and retrieves a shop by id and slug', () => {
      const shop = repo.createShop({
        ownerId,
        name: 'The Gilded Razor',
        slug: 'gilded-razor',
        description: 'Traditional wet shaves and modern fades',
        phone: '+15551234567',
        email: 'info@gildedrazor.com',
        website: 'https://gildedrazor.com',
        timezone: 'America/New_York',
        currency: 'USD',
        status: 'active',
      });

      expect(shop.id).toMatch(/^shop_/);
      expect(shop.name).toBe('The Gilded Razor');
      expect(shop.slug).toBe('gilded-razor');
      expect(shop.status).toBe('active');
      expect(shop.ratingAvg).toBe(0);
      expect(shop.ratingCount).toBe(0);

      const byId = repo.findShopById(shop.id);
      expect(byId).toEqual(shop);

      const bySlug = repo.findShopBySlug('gilded-razor');
      expect(bySlug).toEqual(shop);
      expect(repo.slugExists('gilded-razor')).toBe(true);
      expect(repo.slugExists('non-existent')).toBe(false);
    });

    it('updates shop details and rating', () => {
      const shop = repo.createShop({
        ownerId,
        name: 'Razor Co',
        slug: 'razor-co',
      });

      const updated = repo.updateShop(shop.id, {
        name: 'Razor & Co Master Barbers',
        description: 'Premium grooming lounge',
        status: 'active',
      });

      expect(updated.name).toBe('Razor & Co Master Barbers');
      expect(updated.description).toBe('Premium grooming lounge');
      expect(updated.status).toBe('active');

      const withRating = repo.updateRating(shop.id, 4.85, 42);
      expect(withRating.ratingAvg).toBe(4.85);
      expect(withRating.ratingCount).toBe(42);
    });

    it('lists shops with filters and pagination', () => {
      const s1 = repo.createShop({ ownerId, name: 'Shop 1', slug: 'shop-1', status: 'active' });
      const s2 = repo.createShop({ ownerId, name: 'Shop 2', slug: 'shop-2', status: 'draft' });

      const activeList = repo.listShops({ status: 'active' });
      expect(activeList).toHaveLength(1);
      expect(activeList[0]!.id).toBe(s1.id);

      const count = repo.countShops({ ownerId });
      expect(count).toBe(2);

      const paged = repo.listShops({ ownerId, limit: 1, offset: 0 });
      expect(paged).toHaveLength(1);
    });

    it('soft deletes a shop and excludes it from standard queries', () => {
      const shop = repo.createShop({ ownerId, name: 'Doomed Shop', slug: 'doomed' });

      repo.softDeleteShop(shop.id);

      expect(repo.findShopById(shop.id)).toBeNull();
      expect(repo.findShopBySlug('doomed')).toBeNull();
      expect(repo.slugExists('doomed')).toBe(false);

      const deleted = repo.findShopById(shop.id, { includeDeleted: true });
      expect(deleted).not.toBeNull();
      expect(deleted?.deletedAt).not.toBeNull();
      expect(deleted?.status).toBe('closed');
    });
  });

  describe('branches', () => {
    let shopId: string;

    beforeEach(() => {
      const shop = repo.createShop({ ownerId, name: 'Downtown Barbers', slug: 'downtown-barbers' });
      shopId = shop.id;
    });

    it('creates and lists branches for a shop', () => {
      const b1 = repo.createBranch({
        shopId,
        name: 'Flagship Downtown',
        addressLine1: '100 Main St',
        city: 'New York',
        region: 'NY',
        postalCode: '10001',
        country: 'US',
        phone: '+12125550100',
        latitude: 40.7128,
        longitude: -74.006,
      });

      expect(b1.id).toMatch(/^brch_/);
      expect(b1.name).toBe('Flagship Downtown');
      expect(b1.latitude).toBe(40.7128);

      const list = repo.listBranchesForShop(shopId);
      expect(list).toHaveLength(1);
      expect(list[0]!.id).toBe(b1.id);
    });

    it('updates branch and handles soft delete', () => {
      const branch = repo.createBranch({
        shopId,
        name: 'Uptown Branch',
        addressLine1: '500 5th Ave',
        city: 'New York',
        postalCode: '10036',
      });

      const updated = repo.updateBranch(branch.id, {
        name: 'Uptown Salon & Barbershop',
        status: 'temporarily_closed',
      });
      expect(updated.name).toBe('Uptown Salon & Barbershop');
      expect(updated.status).toBe('temporarily_closed');

      repo.softDeleteBranch(branch.id);
      expect(repo.findBranchById(branch.id)).toBeNull();
      expect(repo.findBranchById(branch.id, { includeDeleted: true })?.deletedAt).not.toBeNull();
    });
  });

  describe('business hours and holidays', () => {
    let branchId: string;

    beforeEach(() => {
      const shop = repo.createShop({ ownerId, name: 'City Shop', slug: 'city-shop' });
      const branch = repo.createBranch({
        shopId: shop.id,
        name: 'Main',
        addressLine1: '123 Test St',
        city: 'City',
        postalCode: '12345',
      });
      branchId = branch.id;
    });

    it('configures weekly business hours and overrides existing schedules', () => {
      const hours = repo.setBusinessHours(branchId, [
        { weekday: 1, opensAt: '09:00', closesAt: '18:00', closed: false },
        { weekday: 2, opensAt: '09:00', closesAt: '18:00', closed: false },
        { weekday: 0, closed: true },
      ]);

      expect(hours).toHaveLength(3);
      expect(hours.find((h) => h.weekday === 1)?.opensAt).toBe('09:00');
      expect(hours.find((h) => h.weekday === 0)?.closed).toBe(true);

      // Re-setting replaces previously configured hours
      const updated = repo.setBusinessHours(branchId, [
        { weekday: 1, opensAt: '10:00', closesAt: '19:00', closed: false },
      ]);
      expect(updated).toHaveLength(1);
      expect(updated[0]!.opensAt).toBe('10:00');
    });

    it('manages holidays including recurring ones', () => {
      const xmas = repo.addHoliday({
        branchId,
        holidayDate: '2026-12-25',
        name: 'Christmas Day',
        recurring: true,
      });

      const oneOff = repo.addHoliday({
        branchId,
        holidayDate: '2026-11-15',
        name: 'Renovation Day',
        recurring: false,
      });

      expect(xmas.id).toMatch(/^sched_/);
      expect(repo.isHoliday(branchId, '2026-12-25')).toBe(true);
      // Recurring matches year-independently on month-day
      expect(repo.isHoliday(branchId, '2027-12-25')).toBe(true);
      expect(repo.isHoliday(branchId, '2026-11-15')).toBe(true);
      expect(repo.isHoliday(branchId, '2027-11-15')).toBe(false);
      expect(repo.isHoliday(branchId, '2026-07-04')).toBe(false);

      repo.deleteHoliday(oneOff.id);
      expect(repo.isHoliday(branchId, '2026-11-15')).toBe(false);
    });
  });
});
