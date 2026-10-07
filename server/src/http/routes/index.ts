import { Router } from 'express';
import type { AppConfig } from '../../core/config';
import type { Logger } from '../../core/logger';
import type { AuthService } from '../../domain/auth/service';
import type { Db } from '../../db/sqlite';
import type { CatalogService } from '../../domain/catalog/service';
import type { BookingsService } from '../../domain/booking/service';
import type { AvailabilityService } from '../../domain/booking/availability';
import type { PaymentService } from '../../domain/payment/service';
import type { PromotionsService } from '../../domain/growth/promotions';
import type { LoyaltyService } from '../../domain/growth/loyalty';
import type { ReviewsService } from '../../domain/growth/reviews';
import type { NotificationsService } from '../../domain/growth/notifications';
import type { FavoritesRepository } from '../../db/repositories/favorites';
import type { CouponsRepository } from '../../db/repositories/coupons';
import type { DiscoveryService } from '../../domain/discovery/service';
import type { AnalyticsService } from '../../domain/analytics/service';
import type { StaffRepository } from '../../db/repositories/staff';
import type { ShopsRepository } from '../../db/repositories/shops';
import { createAuthRouter } from './auth';
import { createCatalogRouter } from './catalog';
import { createBookingsRouter } from './bookings';
import { createPaymentsRouter } from './payments';
import { createGrowthRouter } from './growth';
import { createDiscoveryRouter } from './discovery';
import { createAnalyticsRouter } from './analytics';
import { createAuditRouter } from './audit';

/**
 * API router: every domain module mounts here under `/api/v1`.
 * Adding a module is one line — cross-cutting concerns (versioning, auth
 * context, error envelope) are already applied by the app factory.
 */
export interface ApiRouterDeps {
  db: Db;
  config: AppConfig;
  logger: Logger;
  auth: AuthService;
  catalog: CatalogService;
  bookings: BookingsService;
  availability: AvailabilityService;
  payments: PaymentService;
  discovery: DiscoveryService;
  analytics: AnalyticsService;
  staffRepo: StaffRepository;
  shopsRepo: ShopsRepository;
  growth: {
    promotions: PromotionsService;
    loyalty: LoyaltyService;
    reviews: ReviewsService;
    notifications: NotificationsService;
    favoritesRepo: FavoritesRepository;
    couponsRepo: CouponsRepository;
  };
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();

  router.use('/auth', createAuthRouter(deps));
  router.use(createCatalogRouter(deps));
  router.use(createBookingsRouter(deps));
  router.use(createPaymentsRouter(deps));
  router.use(createDiscoveryRouter(deps));
  router.use(createAnalyticsRouter(deps));
  router.use('/audit-logs', createAuditRouter({ db: deps.db, config: deps.config }));
  router.use(
    createGrowthRouter({
      db: deps.db,
      config: deps.config,
      logger: deps.logger,
      ...deps.growth,
    }),
  );

  return router;
}
