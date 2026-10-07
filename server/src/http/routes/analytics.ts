import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../core/config';
import type { Logger } from '../../core/logger';
import type { Db } from '../../db/sqlite';
import type { AnalyticsService } from '../../domain/analytics/service';
import type { StaffRepository } from '../../db/repositories/staff';
import type { ShopsRepository } from '../../db/repositories/shops';
import { ForbiddenError, NotFoundError } from '../../core/errors';
import { asyncHandler } from '../asyncHandler';
import { authenticate, currentPrincipal, requirePermission } from '../middleware/auth';
import { sendOk } from '../responses';
import { parseQuery } from '../validate';

export interface AnalyticsRouterDeps {
  db: Db;
  config: AppConfig;
  logger: Logger;
  analytics: AnalyticsService;
  staffRepo: StaffRepository;
  shopsRepo: ShopsRepository;
}

const DateRangeQuerySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export function createAnalyticsRouter(deps: AnalyticsRouterDeps): Router {
  const router = Router();
  const auth = authenticate(deps);
  const { analytics, staffRepo, shopsRepo } = deps;

  // ---------------------------------------------------------------------------
  // Shop Level Analytics (Owner / Manager / Admin)
  // ---------------------------------------------------------------------------

  router.get(
    '/analytics/shop/:shopId/overview',
    auth,
    requirePermission('analytics:read:shop'),
    asyncHandler((req, res) => {
      const shopId = req.params.shopId!;
      const query = parseQuery(DateRangeQuerySchema, req);
      const principal = currentPrincipal(res);
      const shop = shopsRepo.findShopById(shopId);
      if (!shop) {
        throw new NotFoundError('Shop', shopId);
      }

      if (principal.role !== 'admin' && shop.ownerId !== principal.userId) {
        throw new ForbiddenError('You can only view analytics for your own shop');
      }

      const revenue = analytics.getShopRevenueOverview(shopId, query.fromDate, query.toDate);
      const bookings = analytics.getShopBookingStats(shopId, query.fromDate, query.toDate);
      const customers = analytics.getShopCustomerStats(shopId, query.fromDate, query.toDate);

      sendOk(res, {
        revenue,
        bookings,
        customers,
      });
    }),
  );

  router.get(
    '/analytics/shop/:shopId/staff',
    auth,
    requirePermission('analytics:read:shop'),
    asyncHandler((req, res) => {
      const shopId = req.params.shopId!;
      const query = parseQuery(DateRangeQuerySchema, req);
      const principal = currentPrincipal(res);
      const shop = shopsRepo.findShopById(shopId);
      if (!shop) {
        throw new NotFoundError('Shop', shopId);
      }

      if (principal.role !== 'admin' && shop.ownerId !== principal.userId) {
        throw new ForbiddenError('You can only view analytics for your own shop');
      }

      const staffPerformance = analytics.getStaffPerformanceStats(
        shopId,
        query.fromDate,
        query.toDate,
      );
      sendOk(res, { staffPerformance });
    }),
  );

  router.get(
    '/analytics/shop/:shopId/services',
    auth,
    requirePermission('analytics:read:shop'),
    asyncHandler((req, res) => {
      const shopId = req.params.shopId!;
      const query = parseQuery(
        DateRangeQuerySchema.extend({ limit: z.coerce.number().optional() }),
        req,
      );
      const principal = currentPrincipal(res);
      const shop = shopsRepo.findShopById(shopId);
      if (!shop) {
        throw new NotFoundError('Shop', shopId);
      }

      if (principal.role !== 'admin' && shop.ownerId !== principal.userId) {
        throw new ForbiddenError('You can only view analytics for your own shop');
      }

      const services = analytics.getPopularServices(
        shopId,
        query.fromDate,
        query.toDate,
        query.limit,
      );
      sendOk(res, { services });
    }),
  );

  // ---------------------------------------------------------------------------
  // Staff Level Earnings & Commission (Barber / Manager / Owner / Admin)
  // ---------------------------------------------------------------------------

  router.get(
    '/analytics/staff/:staffId/earnings',
    auth,
    asyncHandler((req, res) => {
      const staffId = req.params.staffId!;
      const query = parseQuery(DateRangeQuerySchema, req);
      const principal = currentPrincipal(res);
      const staff = staffRepo.findStaffById(staffId);
      if (!staff) {
        throw new NotFoundError('Staff', staffId);
      }

      // Check permission: either staff member themselves, shop owner, or admin
      const isStaffSelf = staff.userId === principal.userId;
      let isOwner = false;
      if (principal.role === 'owner') {
        const shop = shopsRepo.findShopById(staff.shopId);
        isOwner = shop?.ownerId === principal.userId;
      }

      if (!isStaffSelf && !isOwner && principal.role !== 'admin') {
        throw new ForbiddenError('You do not have permission to view earnings for this staff member');
      }

      const earnings = analytics.getStaffEarnings(
        staffId,
        query.fromDate,
        query.toDate,
      );
      sendOk(res, { earnings });
    }),
  );

  return router;
}
