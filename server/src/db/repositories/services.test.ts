import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { ServicesRepository } from './services';
import { ShopsRepository } from './shops';

describe('ServicesRepository', () => {
  let db: Db;
  let servicesRepo: ServicesRepository;
  let shopsRepo: ShopsRepository;
  let shopId: string;
  let branchId: string;

  beforeEach(() => {
    db = createTestDb();
    servicesRepo = new ServicesRepository(db);
    shopsRepo = new ShopsRepository(db);

    const ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@sharp.com', 'owner@sharp.com', 'scrypt_hash', '2026-10-07T00:00:00.000Z',
               'Arthur', 'Shelby', 'Arthur Shelby', 'owner')`,
      [ownerId],
    );

    const shop = shopsRepo.createShop({
      ownerId,
      name: 'Gentleman Cutters',
      slug: 'gentleman-cutters',
      status: 'active',
    });
    shopId = shop.id;

    const branch = shopsRepo.createBranch({
      shopId,
      name: 'Midtown Salon',
      addressLine1: '200 Park Ave',
      city: 'New York',
      postalCode: '10166',
    });
    branchId = branch.id;
  });

  afterEach(() => db.close());

  describe('categories', () => {
    it('creates and lists categories with scoping', () => {
      const platformCat = servicesRepo.createCategory({
        shopId: null,
        name: 'Haircuts',
        slug: 'haircuts',
        sortOrder: 1,
      });

      const shopCat = servicesRepo.createCategory({
        shopId,
        name: 'Beard Trims',
        slug: 'beard-trims',
        sortOrder: 2,
      });

      expect(platformCat.id).toMatch(/^cat_/);
      expect(platformCat.shopId).toBeNull();
      expect(shopCat.shopId).toBe(shopId);

      // List with includePlatform: true
      const combined = servicesRepo.listCategories({ shopId, includePlatform: true });
      expect(combined).toHaveLength(2);
      expect(combined[0]!.slug).toBe('haircuts');
      expect(combined[1]!.slug).toBe('beard-trims');

      // Update category
      const updated = servicesRepo.updateCategory(shopCat.id, { name: 'Luxury Beard Treatments' });
      expect(updated.name).toBe('Luxury Beard Treatments');

      // Soft delete
      servicesRepo.softDeleteCategory(shopCat.id);
      expect(servicesRepo.findCategoryById(shopCat.id)).toBeNull();
      expect(servicesRepo.listCategories({ shopId })).toHaveLength(0);
    });
  });

  describe('services', () => {
    it('creates, retrieves, updates and soft-deletes services', () => {
      const cat = servicesRepo.createCategory({ shopId, name: 'Styling', slug: 'styling' });

      const service = servicesRepo.createService({
        shopId,
        categoryId: cat.id,
        name: 'Signature Skin Fade',
        slug: 'signature-skin-fade',
        description: 'Precision clipper fade with razor edge finish',
        durationMinutes: 45,
        bufferMinutes: 10,
        priceCents: 4500,
        priceType: 'fixed',
        status: 'active',
        sortOrder: 1,
      });

      expect(service.id).toMatch(/^srv_/);
      expect(service.durationMinutes).toBe(45);
      expect(service.bufferMinutes).toBe(10);
      expect(service.priceCents).toBe(4500);

      const bySlug = servicesRepo.findServiceBySlug(shopId, 'signature-skin-fade');
      expect(bySlug).toEqual(service);

      const updated = servicesRepo.updateService(service.id, {
        priceCents: 5000,
        durationMinutes: 50,
      });
      expect(updated.priceCents).toBe(5000);
      expect(updated.durationMinutes).toBe(50);

      // Filter by category
      const list = servicesRepo.listServices({ shopId, categoryId: cat.id });
      expect(list).toHaveLength(1);

      servicesRepo.softDeleteService(service.id);
      expect(servicesRepo.findServiceById(service.id)).toBeNull();
      expect(servicesRepo.listServices({ shopId })).toHaveLength(0);
    });
  });

  describe('branch service overrides and availability', () => {
    it('applies branch price overrides and respects branch disabled status', () => {
      const s1 = servicesRepo.createService({
        shopId,
        name: 'Classic Cut',
        slug: 'classic-cut',
        durationMinutes: 30,
        priceCents: 3500,
      });

      const s2 = servicesRepo.createService({
        shopId,
        name: 'Hot Towel Shave',
        slug: 'hot-towel-shave',
        durationMinutes: 30,
        priceCents: 4000,
      });

      // Default: both services enabled at base prices
      let branchServices = servicesRepo.listServicesForBranch(branchId);
      expect(branchServices).toHaveLength(2);
      expect(branchServices.find((s) => s.id === s1.id)?.effectivePriceCents).toBe(3500);
      expect(branchServices.find((s) => s.id === s1.id)?.hasPriceOverride).toBe(false);

      // Override price for s1 at branch
      servicesRepo.configureBranchService({
        branchId,
        serviceId: s1.id,
        priceCents: 4200,
        enabled: true,
      });

      // Disable s2 at this branch
      servicesRepo.configureBranchService({
        branchId,
        serviceId: s2.id,
        enabled: false,
      });

      branchServices = servicesRepo.listServicesForBranch(branchId);
      const bS1 = branchServices.find((s) => s.id === s1.id);
      const bS2 = branchServices.find((s) => s.id === s2.id);

      expect(bS1?.effectivePriceCents).toBe(4200);
      expect(bS1?.hasPriceOverride).toBe(true);
      expect(bS1?.branchEnabled).toBe(true);

      expect(bS2?.branchEnabled).toBe(false);

      // Filter enabled only
      const enabledOnly = servicesRepo.listServicesForBranch(branchId, { enabledOnly: true });
      expect(enabledOnly).toHaveLength(1);
      expect(enabledOnly[0]!.id).toBe(s1.id);
    });
  });
});
