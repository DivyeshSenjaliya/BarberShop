import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';
import { createTestConfig, createTestDb, createTestLogger } from '../../test-support/db';
import type { AppConfig } from '../../core/config';
import type { Db } from '../../db/sqlite';
import { UsersRepository } from '../../db/repositories/users';
import { ShopsRepository } from '../../db/repositories/shops';
import { ServicesRepository } from '../../db/repositories/services';
import { StaffRepository } from '../../db/repositories/staff';
import { newId } from '../../core/ids';

interface Harness {
  app: Express;
  db: Db;
  config: AppConfig;
  shop1Id: string;
  shop2Id: string;
}

function buildApp(): Harness {
  const config = createTestConfig();
  const db = createTestDb();
  const app = createApp({ config, logger: createTestLogger(), db });

  const usersRepo = new UsersRepository(db);
  const shopsRepo = new ShopsRepository(db);
  const servicesRepo = new ServicesRepository(db);
  const staffRepo = new StaffRepository(db);

  const ownerId = newId('usr');
  usersRepo.insert({
    id: ownerId,
    email: 'owner@discovery.com',
    passwordHash: 'dummy',
    firstName: 'Shop',
    lastName: 'Owner',
    role: 'owner',
  });

  // Shop 1: Manhattan (40.7128, -74.0060)
  const shop1 = shopsRepo.createShop({
    ownerId,
    name: 'Manhattan Barber Lounge',
    slug: 'manhattan-barber-lounge',
    status: 'active',
  });

  // Update rating
  db.run(`UPDATE shops SET rating_avg = 4.9, rating_count = 150 WHERE id = ?`, [shop1.id]);

  shopsRepo.createBranch({
    shopId: shop1.id,
    name: 'Downtown',
    addressLine1: '120 Broadway',
    city: 'New York',
    postalCode: '10005',
    latitude: 40.7128,
    longitude: -74.006,
    status: 'active',
  });

  const srv1 = servicesRepo.createService({
    shopId: shop1.id,
    name: 'Signature Fade',
    slug: 'signature-fade',
    durationMinutes: 45,
    priceCents: 4500,
  });

  const staff1 = staffRepo.createStaff({
    shopId: shop1.id,
    employeeCode: 'EMP-01',
    displayName: 'Leonardo Barber',
    status: 'active',
    canAcceptBookings: true,
  });
  staffRepo.setStaffServices(staff1.id, [srv1.id]);

  // Shop 2: Brooklyn (40.6782, -73.9442)
  const shop2 = shopsRepo.createShop({
    ownerId,
    name: 'Brooklyn Clipper Club',
    slug: 'brooklyn-clipper-club',
    status: 'active',
  });

  db.run(`UPDATE shops SET rating_avg = 4.1, rating_count = 30 WHERE id = ?`, [shop2.id]);

  shopsRepo.createBranch({
    shopId: shop2.id,
    name: 'Heights',
    addressLine1: '300 Fulton St',
    city: 'Brooklyn',
    postalCode: '11201',
    latitude: 40.6782,
    longitude: -73.9442,
    status: 'active',
  });

  servicesRepo.createService({
    shopId: shop2.id,
    name: 'Standard Buzz',
    slug: 'standard-buzz',
    durationMinutes: 20,
    priceCents: 2500,
  });

  return {
    app,
    db,
    config,
    shop1Id: shop1.id,
    shop2Id: shop2.id,
  };
}

describe('Discovery HTTP Routes (/api/v1/discovery)', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = buildApp();
  });

  afterEach(() => {
    harness.db.close();
  });

  describe('GET /api/v1/discovery/shops', () => {
    it('returns all active shops sorted by rating by default', async () => {
      const { app } = harness;
      const res = await request(app).get('/api/v1/discovery/shops');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.items[0].name).toBe('Manhattan Barber Lounge');
      expect(res.body.data.items[0].ratingAvg).toBe(4.9);
      expect(res.body.data.items[1].name).toBe('Brooklyn Clipper Club');
    });

    it('searches shops by keyword', async () => {
      const { app } = harness;
      const res = await request(app).get('/api/v1/discovery/shops?query=Brooklyn');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].name).toBe('Brooklyn Clipper Club');
    });

    it('filters shops by minimum rating threshold', async () => {
      const { app } = harness;
      const res = await request(app).get('/api/v1/discovery/shops?minRating=4.5');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].name).toBe('Manhattan Barber Lounge');
    });

    it('sorts shops by price ascending', async () => {
      const { app } = harness;
      const res = await request(app).get('/api/v1/discovery/shops?sortBy=price_asc');

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].name).toBe('Brooklyn Clipper Club');
      expect(res.body.data.items[0].startingPriceCents).toBe(2500);
    });

    it('sorts shops by distance from user location', async () => {
      const { app } = harness;
      // Coordinates right near Manhattan branch
      const res = await request(app).get(
        '/api/v1/discovery/shops?latitude=40.713&longitude=-74.006&sortBy=distance',
      );

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].name).toBe('Manhattan Barber Lounge');
      expect(res.body.data.items[0].closestDistanceKm).toBeLessThan(1);
      expect(res.body.data.items[1].closestDistanceKm).toBeGreaterThan(4);
    });
  });

  describe('GET /api/v1/discovery/barbers', () => {
    it('discovers active barbers with associated services', async () => {
      const { app } = harness;
      const res = await request(app).get('/api/v1/discovery/barbers?query=Leonardo');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].displayName).toBe('Leonardo Barber');
      expect(res.body.data.items[0].shopName).toBe('Manhattan Barber Lounge');
      expect(res.body.data.items[0].services).toHaveLength(1);
      expect(res.body.data.items[0].services[0].name).toBe('Signature Fade');
    });
  });

  describe('GET /api/v1/discovery/services', () => {
    it('searches and filters services by price range', async () => {
      const { app } = harness;
      const res = await request(app).get(
        '/api/v1/discovery/services?minPriceCents=3000&sortBy=price_desc',
      );

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].name).toBe('Signature Fade');
      expect(res.body.data.items[0].priceCents).toBe(4500);
    });
  });
});
