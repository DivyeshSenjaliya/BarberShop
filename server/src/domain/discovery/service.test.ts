import { newId } from '../../core/ids';
import { createTestDb, createTestLogger } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { DiscoveryService } from './service';

describe('DiscoveryService', () => {
  let db: Db;
  let service: DiscoveryService;
  let shop1Id: string;
  let shop2Id: string;
  let staffId: string;
  let serviceId: string;

  beforeEach(() => {
    db = createTestDb();
    service = new DiscoveryService({
      db,
      logger: createTestLogger(),
    });

    const ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@shop.com', 'owner@shop.com', 'h', '2026-10-07T00:00:00.000Z',
               'Owner', 'Shop', 'Owner Shop', 'owner')`,
      [ownerId],
    );

    // Shop 1: Downtown Manhattan (40.7128, -74.0060) - 4.8 rating, $40 starting price
    shop1Id = newId('shop');
    db.run(
      `INSERT INTO shops (id, owner_id, name, slug, status, rating_avg, rating_count)
       VALUES (?, ?, 'Manhattan Master Cuts', 'manhattan-master-cuts', 'active', 4.8, 120)`,
      [shop1Id, ownerId],
    );

    const branch1Id = newId('brch');
    db.run(
      `INSERT INTO branches (id, shop_id, name, address_line1, city, postal_code, latitude, longitude, status)
       VALUES (?, ?, 'Downtown', '100 Broadway', 'New York', '10005', 40.7128, -74.0060, 'active')`,
      [branch1Id, shop1Id],
    );

    serviceId = newId('srv');
    db.run(
      `INSERT INTO services (id, shop_id, name, slug, duration_minutes, price_cents, status)
       VALUES (?, ?, 'Executive Cut', 'executive-cut', 45, 4000, 'active')`,
      [serviceId, shop1Id],
    );

    staffId = newId('staff');
    db.run(
      `INSERT INTO staff (id, shop_id, employee_code, display_name, status, can_accept_bookings)
       VALUES (?, ?, 'EMP-01', 'Arthur Shelby', 'active', 1)`,
      [staffId, shop1Id],
    );

    db.run(
      `INSERT INTO staff_services (staff_id, service_id) VALUES (?, ?)`,
      [staffId, serviceId],
    );

    // Shop 2: Brooklyn (40.6782, -73.9442) - 4.2 rating, $25 starting price
    shop2Id = newId('shop');
    db.run(
      `INSERT INTO shops (id, owner_id, name, slug, status, rating_avg, rating_count)
       VALUES (?, ?, 'Brooklyn Clipper Co', 'brooklyn-clipper-co', 'active', 4.2, 45)`,
      [shop2Id, ownerId],
    );

    const branch2Id = newId('brch');
    db.run(
      `INSERT INTO branches (id, shop_id, name, address_line1, city, postal_code, latitude, longitude, status)
       VALUES (?, ?, 'Crown Heights', '500 Nostrand Ave', 'Brooklyn', '11216', 40.6782, -73.9442, 'active')`,
      [branch2Id, shop2Id],
    );

    const srv2Id = newId('srv');
    db.run(
      `INSERT INTO services (id, shop_id, name, slug, duration_minutes, price_cents, status)
       VALUES (?, ?, 'Classic Buzz', 'classic-buzz', 20, 2500, 'active')`,
      [srv2Id, shop2Id],
    );
  });

  afterEach(() => db.close());

  describe('searchShops', () => {
    it('returns all active shops sorted by rating by default', () => {
      const res = service.searchShops();
      expect(res.total).toBe(2);
      expect(res.items[0]!.name).toBe('Manhattan Master Cuts'); // 4.8 > 4.2
      expect(res.items[1]!.name).toBe('Brooklyn Clipper Co');
    });

    it('filters by query text matching shop or branch city', () => {
      const res = service.searchShops({ query: 'Brooklyn' });
      expect(res.total).toBe(1);
      expect(res.items[0]!.name).toBe('Brooklyn Clipper Co');
    });

    it('filters by minimum rating threshold', () => {
      const res = service.searchShops({ minRating: 4.5 });
      expect(res.total).toBe(1);
      expect(res.items[0]!.name).toBe('Manhattan Master Cuts');
    });

    it('filters and sorts by price ascending', () => {
      const res = service.searchShops({ sortBy: 'price_asc' });
      expect(res.items[0]!.name).toBe('Brooklyn Clipper Co'); // $25 < $40
      expect(res.items[0]!.startingPriceCents).toBe(2500);
    });

    it('calculates geo distance and filters within radius', () => {
      // User is located right near Manhattan branch (40.7130, -74.0062)
      const res = service.searchShops({
        latitude: 40.713,
        longitude: -74.0062,
        sortBy: 'distance',
      });

      expect(res.total).toBe(2);
      expect(res.items[0]!.name).toBe('Manhattan Master Cuts');
      expect(res.items[0]!.closestDistanceKm).toBeLessThan(1); // very close (<1 km)
      expect(res.items[1]!.closestDistanceKm).toBeGreaterThan(5); // Brooklyn is ~6 km away
    });
  });

  describe('searchBarbers', () => {
    it('finds active barbers and their qualified services', () => {
      const res = service.searchBarbers({ query: 'Arthur' });
      expect(res.total).toBe(1);
      expect(res.items[0]!.displayName).toBe('Arthur Shelby');
      expect(res.items[0]!.shopName).toBe('Manhattan Master Cuts');
      expect(res.items[0]!.services).toHaveLength(1);
      expect(res.items[0]!.services[0]!.name).toBe('Executive Cut');
    });
  });

  describe('searchServices', () => {
    it('discovers services with price filtering and ordering', () => {
      const res = service.searchServices({
        minPriceCents: 3000,
        sortBy: 'price_desc',
      });

      expect(res.total).toBe(1);
      expect(res.items[0]!.name).toBe('Executive Cut');
      expect(res.items[0]!.priceCents).toBe(4000);
    });
  });
});
