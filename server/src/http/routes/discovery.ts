import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../core/config';
import type { Logger } from '../../core/logger';
import type { Db } from '../../db/sqlite';
import type { DiscoveryService } from '../../domain/discovery/service';
import { asyncHandler } from '../asyncHandler';
import { sendOk } from '../responses';
import { parseQuery } from '../validate';

export interface DiscoveryRouterDeps {
  db: Db;
  config: AppConfig;
  logger: Logger;
  discovery: DiscoveryService;
}

const SearchShopsQuerySchema = z.object({
  query: z.string().trim().optional(),
  categoryId: z.string().optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().optional(),
  sortBy: z.enum(['rating', 'distance', 'price_asc', 'price_desc', 'popularity', 'name']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const SearchBarbersQuerySchema = z.object({
  query: z.string().trim().optional(),
  shopId: z.string().optional(),
  serviceId: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sortBy: z.enum(['rating', 'name']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const SearchServicesQuerySchema = z.object({
  query: z.string().trim().optional(),
  shopId: z.string().optional(),
  categoryId: z.string().optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'name']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function createDiscoveryRouter(deps: DiscoveryRouterDeps): Router {
  const router = Router();
  const { discovery } = deps;

  router.get(
    '/discovery/shops',
    asyncHandler((req, res) => {
      const query = parseQuery(SearchShopsQuerySchema, req);
      const result = discovery.searchShops(query);
      sendOk(res, result);
    }),
  );

  router.get(
    '/discovery/barbers',
    asyncHandler((req, res) => {
      const query = parseQuery(SearchBarbersQuerySchema, req);
      const result = discovery.searchBarbers(query);
      sendOk(res, result);
    }),
  );

  router.get(
    '/discovery/services',
    asyncHandler((req, res) => {
      const query = parseQuery(SearchServicesQuerySchema, req);
      const result = discovery.searchServices(query);
      sendOk(res, result);
    }),
  );

  return router;
}
