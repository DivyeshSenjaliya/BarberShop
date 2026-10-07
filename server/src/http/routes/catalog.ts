import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../core/config';
import type { Logger } from '../../core/logger';
import type { Db } from '../../db/sqlite';
import type { Role } from '../../domain/auth/rbac';
import { CatalogService, type Actor } from '../../domain/catalog/service';
import { asyncHandler } from '../asyncHandler';
import { authenticate, currentPrincipal, requirePermission } from '../middleware/auth';
import { sendCreated, sendNoContent, sendOk } from '../responses';
import { parseBody, parseQuery } from '../validate';

export interface CatalogRouterDeps {
  db: Db;
  config: AppConfig;
  logger: Logger;
  catalog: CatalogService;
}

function actorFrom(res: Response): Actor {
  const p = currentPrincipal(res);
  return { userId: p.userId, role: p.role as Role };
}

// Schemas
const CreateShopSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/i, 'Invalid slug format').optional(),
  description: z.string().trim().max(1000).nullish(),
  phone: z.string().trim().max(30).nullish(),
  email: z.string().trim().email().nullish(),
  website: z.string().trim().url().nullish(),
  timezone: z.string().trim().min(2).max(60).optional(),
  currency: z.string().trim().length(3).optional(),
  logoUrl: z.string().trim().url().nullish(),
  coverUrl: z.string().trim().url().nullish(),
  status: z.enum(['draft', 'pending', 'active', 'suspended', 'closed']).optional(),
  ownerId: z.string().optional(),
});

const UpdateShopSchema = CreateShopSchema.partial();

const CreateBranchSchema = z.object({
  name: z.string().trim().min(2).max(100),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).nullish(),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().max(100).nullish(),
  postalCode: z.string().trim().min(2).max(20),
  country: z.string().trim().length(2).optional(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  phone: z.string().trim().max(30).nullish(),
  timezone: z.string().trim().max(60).nullish(),
  status: z.enum(['active', 'temporarily_closed', 'closed']).optional(),
});

const UpdateBranchSchema = CreateBranchSchema.partial();

const SetBusinessHoursSchema = z.object({
  hours: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      opensAt: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).nullish(),
      closesAt: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).nullish(),
      closed: z.boolean().optional(),
    }),
  ),
});

const CreateHolidaySchema = z.object({
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  name: z.string().trim().min(2).max(100),
  recurring: z.boolean().optional(),
});

const CreateCategorySchema = z.object({
  shopId: z.string().nullish(),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/i).optional(),
  description: z.string().trim().max(500).nullish(),
  iconUrl: z.string().trim().url().nullish(),
  sortOrder: z.number().int().optional(),
});

const CreateServiceSchema = z.object({
  categoryId: z.string().nullish(),
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/i).optional(),
  description: z.string().trim().max(1000).nullish(),
  durationMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  priceCents: z.number().int().min(0),
  priceType: z.enum(['fixed', 'from', 'custom']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  imageUrl: z.string().trim().url().nullish(),
  sortOrder: z.number().int().optional(),
});

const UpdateServiceSchema = CreateServiceSchema.partial();

const ConfigureBranchServiceSchema = z.object({
  enabled: z.boolean().optional(),
  priceCents: z.number().int().min(0).nullish(),
});

const CreateStaffSchema = z.object({
  employeeCode: z.string().trim().min(1).max(40),
  displayName: z.string().trim().min(2).max(100),
  userId: z.string().nullish(),
  title: z.string().trim().max(100).nullish(),
  bio: z.string().trim().max(1000).nullish(),
  avatarUrl: z.string().trim().url().nullish(),
  email: z.string().trim().email().nullish(),
  phone: z.string().trim().max(30).nullish(),
  commissionBps: z.number().int().min(0).max(10000).optional(),
  status: z.enum(['invited', 'active', 'inactive', 'terminated']).optional(),
  employment: z.enum(['full_time', 'part_time', 'contract', 'chair_rental']).optional(),
  canAcceptBookings: z.boolean().optional(),
  hiredAt: z.string().nullish(),
});

const UpdateStaffSchema = CreateStaffSchema.partial();

const SetStaffServicesSchema = z.object({
  serviceIds: z.array(z.string()),
});

const SetStaffSchedulesSchema = z.object({
  schedules: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      startsAt: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/),
      endsAt: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/),
    }),
  ),
});

export function createCatalogRouter(deps: CatalogRouterDeps): Router {
  const router = Router();
  const auth = authenticate(deps);
  const { catalog } = deps;

  // ---------------------------------------------------------------------------
  // Shops
  // ---------------------------------------------------------------------------

  router.get(
    '/shops',
    asyncHandler((req, res) => {
      const query = parseQuery(
        z.object({
          ownerId: z.string().optional(),
          status: z.enum(['draft', 'pending', 'active', 'suspended', 'closed']).optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
          offset: z.coerce.number().int().min(0).optional(),
        }),
        req,
      );
      const result = catalog.listShops(query);
      sendOk(res, result);
    }),
  );

  router.post(
    '/shops',
    auth,
    requirePermission('shop:write'),
    asyncHandler((req, res) => {
      const body = parseBody(CreateShopSchema, req);
      const shop = catalog.createShop(actorFrom(res), body);
      sendCreated(res, { shop });
    }),
  );

  router.get(
    '/shops/:idOrSlug',
    asyncHandler((req, res) => {
      const shop = catalog.getShop(req.params.idOrSlug!);
      sendOk(res, { shop });
    }),
  );

  router.patch(
    '/shops/:shopId',
    auth,
    requirePermission('shop:write'),
    asyncHandler((req, res) => {
      const body = parseBody(UpdateShopSchema, req);
      const shop = catalog.updateShop(actorFrom(res), req.params.shopId!, body);
      sendOk(res, { shop });
    }),
  );

  router.delete(
    '/shops/:shopId',
    auth,
    requirePermission('shop:write'),
    asyncHandler((req, res) => {
      catalog.deleteShop(actorFrom(res), req.params.shopId!);
      sendNoContent(res);
    }),
  );

  // ---------------------------------------------------------------------------
  // Branches
  // ---------------------------------------------------------------------------

  router.get(
    '/shops/:shopId/branches',
    asyncHandler((req, res) => {
      const branches = catalog.listBranches(req.params.shopId!);
      sendOk(res, { branches });
    }),
  );

  router.post(
    '/shops/:shopId/branches',
    auth,
    requirePermission('branch:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(CreateBranchSchema, req);
      const branch = catalog.createBranch(actorFrom(res), req.params.shopId!, body);
      sendCreated(res, { branch });
    }),
  );

  router.get(
    '/branches/:branchId',
    asyncHandler((req, res) => {
      const branch = catalog.getBranch(req.params.branchId!);
      sendOk(res, { branch });
    }),
  );

  router.patch(
    '/branches/:branchId',
    auth,
    requirePermission('branch:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(UpdateBranchSchema, req);
      const branch = catalog.updateBranch(actorFrom(res), req.params.branchId!, body);
      sendOk(res, { branch });
    }),
  );

  router.delete(
    '/branches/:branchId',
    auth,
    requirePermission('branch:manage'),
    asyncHandler((req, res) => {
      catalog.deleteBranch(actorFrom(res), req.params.branchId!);
      sendNoContent(res);
    }),
  );

  router.get(
    '/branches/:branchId/hours',
    asyncHandler((req, res) => {
      const hours = catalog.getBusinessHours(req.params.branchId!);
      sendOk(res, { hours });
    }),
  );

  router.put(
    '/branches/:branchId/hours',
    auth,
    requirePermission('branch:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(SetBusinessHoursSchema, req);
      const hours = catalog.setBusinessHours(actorFrom(res), req.params.branchId!, body.hours);
      sendOk(res, { hours });
    }),
  );

  router.get(
    '/branches/:branchId/holidays',
    asyncHandler((req, res) => {
      const holidays = catalog.listHolidays(req.params.branchId!);
      sendOk(res, { holidays });
    }),
  );

  router.post(
    '/branches/:branchId/holidays',
    auth,
    requirePermission('branch:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(CreateHolidaySchema, req);
      const holiday = catalog.addHoliday(actorFrom(res), req.params.branchId!, body);
      sendCreated(res, { holiday });
    }),
  );

  router.delete(
    '/branches/:branchId/holidays/:holidayId',
    auth,
    requirePermission('branch:manage'),
    asyncHandler((req, res) => {
      catalog.deleteHoliday(actorFrom(res), req.params.branchId!, req.params.holidayId!);
      sendNoContent(res);
    }),
  );

  // ---------------------------------------------------------------------------
  // Categories & Services
  // ---------------------------------------------------------------------------

  router.get(
    '/categories',
    asyncHandler((req, res) => {
      const shopId = req.query.shopId as string | undefined;
      const categories = catalog.listCategories(shopId);
      sendOk(res, { categories });
    }),
  );

  router.post(
    '/categories',
    auth,
    requirePermission('service:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(CreateCategorySchema, req);
      const category = catalog.createCategory(actorFrom(res), body);
      sendCreated(res, { category });
    }),
  );

  router.get(
    '/shops/:shopId/services',
    asyncHandler((req, res) => {
      const categoryId = req.query.categoryId as string | undefined;
      const services = catalog.listServices(req.params.shopId!, categoryId);
      sendOk(res, { services });
    }),
  );

  router.post(
    '/shops/:shopId/services',
    auth,
    requirePermission('service:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(CreateServiceSchema, req);
      const service = catalog.createService(actorFrom(res), req.params.shopId!, body);
      sendCreated(res, { service });
    }),
  );

  router.get(
    '/services/:serviceId',
    asyncHandler((req, res) => {
      const service = catalog.getService(req.params.serviceId!);
      sendOk(res, { service });
    }),
  );

  router.patch(
    '/services/:serviceId',
    auth,
    requirePermission('service:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(UpdateServiceSchema, req);
      const service = catalog.updateService(actorFrom(res), req.params.serviceId!, body);
      sendOk(res, { service });
    }),
  );

  router.delete(
    '/services/:serviceId',
    auth,
    requirePermission('service:manage'),
    asyncHandler((req, res) => {
      catalog.deleteService(actorFrom(res), req.params.serviceId!);
      sendNoContent(res);
    }),
  );

  router.get(
    '/branches/:branchId/services',
    asyncHandler((req, res) => {
      const enabledOnly = req.query.enabledOnly !== 'false';
      const services = catalog.listBranchServices(req.params.branchId!, { enabledOnly });
      sendOk(res, { services });
    }),
  );

  router.put(
    '/branches/:branchId/services/:serviceId',
    auth,
    requirePermission('branch:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(ConfigureBranchServiceSchema, req);
      const config = catalog.configureBranchService(
        actorFrom(res),
        req.params.branchId!,
        req.params.serviceId!,
        body,
      );
      sendOk(res, { config });
    }),
  );

  // ---------------------------------------------------------------------------
  // Staff
  // ---------------------------------------------------------------------------

  router.get(
    '/shops/:shopId/staff',
    asyncHandler((req, res) => {
      const query = parseQuery(
        z.object({
          branchId: z.string().optional(),
          serviceId: z.string().optional(),
          canAcceptBookings: z.coerce.boolean().optional(),
        }),
        req,
      );
      const staff = catalog.listStaff(req.params.shopId!, query);
      sendOk(res, { staff });
    }),
  );

  router.post(
    '/shops/:shopId/staff',
    auth,
    requirePermission('staff:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(CreateStaffSchema, req);
      const staff = catalog.createStaff(actorFrom(res), req.params.shopId!, body);
      sendCreated(res, { staff });
    }),
  );

  router.get(
    '/staff/:staffId',
    asyncHandler((req, res) => {
      const staff = catalog.getStaff(req.params.staffId!);
      sendOk(res, { staff });
    }),
  );

  router.patch(
    '/staff/:staffId',
    auth,
    requirePermission('staff:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(UpdateStaffSchema, req);
      const staff = catalog.updateStaff(actorFrom(res), req.params.staffId!, body);
      sendOk(res, { staff });
    }),
  );

  router.delete(
    '/staff/:staffId',
    auth,
    requirePermission('staff:manage'),
    asyncHandler((req, res) => {
      catalog.deleteStaff(actorFrom(res), req.params.staffId!);
      sendNoContent(res);
    }),
  );

  router.get(
    '/staff/:staffId/services',
    asyncHandler((req, res) => {
      const serviceIds = catalog.getStaffServices(req.params.staffId!);
      sendOk(res, { serviceIds });
    }),
  );

  router.put(
    '/staff/:staffId/services',
    auth,
    requirePermission('staff:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(SetStaffServicesSchema, req);
      catalog.setStaffServices(actorFrom(res), req.params.staffId!, body.serviceIds);
      sendOk(res, { serviceIds: body.serviceIds });
    }),
  );

  router.get(
    '/staff/:staffId/schedules',
    asyncHandler((req, res) => {
      const schedules = catalog.getStaffSchedules(req.params.staffId!);
      sendOk(res, { schedules });
    }),
  );

  router.put(
    '/staff/:staffId/schedules',
    auth,
    requirePermission('schedule:write:shop'),
    asyncHandler((req, res) => {
      const body = parseBody(SetStaffSchedulesSchema, req);
      const schedules = catalog.setStaffSchedules(actorFrom(res), req.params.staffId!, body.schedules);
      sendOk(res, { schedules });
    }),
  );

  return router;
}
