import { Router } from 'express';
import type { AppConfig } from '../../core/config';
import type { Logger } from '../../core/logger';
import type { AuthService } from '../../domain/auth/service';
import type { Db } from '../../db/sqlite';
import type { CatalogService } from '../../domain/catalog/service';
import type { BookingsService } from '../../domain/booking/service';
import type { AvailabilityService } from '../../domain/booking/availability';
import { createAuthRouter } from './auth';
import { createCatalogRouter } from './catalog';
import { createBookingsRouter } from './bookings';

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
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();

  router.use('/auth', createAuthRouter(deps));
  router.use(createCatalogRouter(deps));
  router.use(createBookingsRouter(deps));

  return router;
}
