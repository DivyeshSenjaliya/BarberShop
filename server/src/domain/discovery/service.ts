import type { Db } from '../../db/sqlite';
import type { Logger } from '../../core/logger';
import { haversineDistanceKm, calculateBoundingBox } from '../../core/geo';

export type ShopSortOption = 'rating' | 'distance' | 'price_asc' | 'price_desc' | 'popularity' | 'name';
export type BarberSortOption = 'rating' | 'name';
export type ServiceSortOption = 'price_asc' | 'price_desc' | 'name';

export interface DiscoveredShopBranch {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
}

export interface DiscoveredShop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  startingPriceCents: number | null;
  branches: DiscoveredShopBranch[];
  closestDistanceKm: number | null;
}

export interface ShopDiscoveryFilter {
  query?: string;
  categoryId?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  minRating?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sortBy?: ShopSortOption;
  limit?: number;
  offset?: number;
}

export interface DiscoveredBarber {
  id: string;
  shopId: string;
  shopName: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  services: { id: string; name: string; priceCents: number }[];
}

export interface BarberDiscoveryFilter {
  query?: string;
  shopId?: string;
  serviceId?: string;
  minRating?: number;
  sortBy?: BarberSortOption;
  limit?: number;
  offset?: number;
}

export interface DiscoveredService {
  id: string;
  shopId: string;
  shopName: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
}

export interface ServiceDiscoveryFilter {
  query?: string;
  shopId?: string;
  categoryId?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sortBy?: ServiceSortOption;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface DiscoveryServiceDeps {
  db: Db;
  logger: Logger;
}

export class DiscoveryService {
  constructor(private readonly deps: DiscoveryServiceDeps) {}

  searchShops(filter: ShopDiscoveryFilter = {}): PaginatedResult<DiscoveredShop> {
    const { db } = this.deps;
    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    // 1. Fetch active shops
    let shopQuery = `
      SELECT s.id, s.name, s.slug, s.description, s.logo_url, s.cover_url,
             s.rating_avg, s.rating_count
      FROM shops s
      WHERE s.status = 'active' AND s.deleted_at IS NULL
    `;
    const params: unknown[] = [];

    if (filter.minRating !== undefined && filter.minRating > 0) {
      shopQuery += ` AND s.rating_avg >= ?`;
      params.push(filter.minRating);
    }

    if (filter.query) {
      const q = `%${filter.query.trim()}%`;
      shopQuery += ` AND (s.name LIKE ? OR s.description LIKE ? OR EXISTS (
        SELECT 1 FROM branches b WHERE b.shop_id = s.id AND (b.name LIKE ? OR b.city LIKE ?)
      ) OR EXISTS (
        SELECT 1 FROM services srv WHERE srv.shop_id = s.id AND srv.name LIKE ?
      ))`;
      params.push(q, q, q, q, q);
    }

    if (filter.categoryId) {
      shopQuery += ` AND EXISTS (
        SELECT 1 FROM services srv WHERE srv.shop_id = s.id AND srv.category_id = ? AND srv.deleted_at IS NULL
      )`;
      params.push(filter.categoryId);
    }

    const shopRows = db.all<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      logo_url: string | null;
      cover_url: string | null;
      rating_avg: number;
      rating_count: number;
    }>(shopQuery, params);

    // 2. Hydrate branches and starting prices
    let discovered: DiscoveredShop[] = [];

    for (const s of shopRows) {
      // Branches
      const branches = db
        .all<{
          id: string;
          name: string;
          address_line1: string;
          city: string;
          postal_code: string;
          latitude: number | null;
          longitude: number | null;
        }>(
          `SELECT id, name, address_line1, city, postal_code, latitude, longitude
           FROM branches
           WHERE shop_id = ? AND status = 'active' AND deleted_at IS NULL`,
          [s.id],
        )
        .map((b) => {
          let distanceKm: number | null = null;
          if (
            filter.latitude !== undefined &&
            filter.longitude !== undefined &&
            b.latitude !== null &&
            b.longitude !== null
          ) {
            distanceKm = haversineDistanceKm(
              filter.latitude,
              filter.longitude,
              b.latitude,
              b.longitude,
            );
          }
          return {
            id: b.id,
            name: b.name,
            addressLine1: b.address_line1,
            city: b.city,
            postalCode: b.postal_code,
            latitude: b.latitude,
            longitude: b.longitude,
            distanceKm,
          };
        });

      // Starting price
      const priceRow = db.get<{ min_price: number | null }>(
        `SELECT MIN(price_cents) AS min_price
         FROM services
         WHERE shop_id = ? AND status = 'active' AND deleted_at IS NULL`,
        [s.id],
      );
      const startingPriceCents = priceRow?.min_price ?? null;

      // Price filter check
      if (filter.minPriceCents !== undefined && startingPriceCents !== null) {
        if (startingPriceCents < filter.minPriceCents) continue;
      }
      if (filter.maxPriceCents !== undefined && startingPriceCents !== null) {
        if (startingPriceCents > filter.maxPriceCents) continue;
      }

      // Geo radius check
      let closestDistanceKm: number | null = null;
      if (filter.latitude !== undefined && filter.longitude !== undefined) {
        const distances = branches
          .map((b) => b.distanceKm)
          .filter((d): d is number => d !== null);

        if (distances.length > 0) {
          closestDistanceKm = Math.min(...distances);
        }

        if (filter.radiusKm !== undefined) {
          if (closestDistanceKm === null || closestDistanceKm > filter.radiusKm) {
            continue; // out of radius
          }
        }
      }

      discovered.push({
        id: s.id,
        name: s.name,
        slug: s.slug,
        description: s.description,
        logoUrl: s.logo_url,
        coverUrl: s.cover_url,
        ratingAvg: s.rating_avg,
        ratingCount: s.rating_count,
        startingPriceCents,
        branches,
        closestDistanceKm,
      });
    }

    // 3. Sorting
    const sortBy = filter.sortBy ?? 'rating';
    discovered.sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          if (a.closestDistanceKm === null) return 1;
          if (b.closestDistanceKm === null) return -1;
          return a.closestDistanceKm - b.closestDistanceKm;
        case 'price_asc':
          return (a.startingPriceCents ?? Infinity) - (b.startingPriceCents ?? Infinity);
        case 'price_desc':
          return (b.startingPriceCents ?? 0) - (a.startingPriceCents ?? 0);
        case 'popularity':
          return b.ratingCount - a.ratingCount;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rating':
        default:
          if (b.ratingAvg !== a.ratingAvg) {
            return b.ratingAvg - a.ratingAvg;
          }
          return b.ratingCount - a.ratingCount;
      }
    });

    const total = discovered.length;
    const items = discovered.slice(offset, offset + limit);

    return { items, total, limit, offset };
  }

  searchBarbers(filter: BarberDiscoveryFilter = {}): PaginatedResult<DiscoveredBarber> {
    const { db } = this.deps;
    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    let query = `
      SELECT st.id, st.shop_id, s.name AS shop_name, st.display_name, st.bio, st.avatar_url
      FROM staff st
      JOIN shops s ON s.id = st.shop_id
      WHERE st.status = 'active' AND st.can_accept_bookings = 1 AND s.status = 'active' AND s.deleted_at IS NULL
    `;
    const params: unknown[] = [];

    if (filter.shopId) {
      query += ` AND st.shop_id = ?`;
      params.push(filter.shopId);
    }

    if (filter.query) {
      const q = `%${filter.query.trim()}%`;
      query += ` AND (st.display_name LIKE ? OR s.name LIKE ?)`;
      params.push(q, q);
    }

    if (filter.serviceId) {
      query += ` AND EXISTS (
        SELECT 1 FROM staff_services ss WHERE ss.staff_id = st.id AND ss.service_id = ?
      )`;
      params.push(filter.serviceId);
    }

    const rows = db.all<{
      id: string;
      shop_id: string;
      shop_name: string;
      display_name: string;
      bio: string | null;
      avatar_url: string | null;
    }>(query, params);

    const barbers: DiscoveredBarber[] = [];

    for (const r of rows) {
      // Calculate staff rating from reviews
      const ratingRow = db.get<{ avg_rating: number | null; count: number }>(
        `SELECT AVG(staff_rating) AS avg_rating, COUNT(*) AS count
         FROM reviews
         WHERE staff_id = ? AND staff_rating IS NOT NULL AND status = 'published'`,
        [r.id],
      );

      const ratingAvg = ratingRow?.avg_rating ? Math.round(ratingRow.avg_rating * 10) / 10 : 0;
      const ratingCount = ratingRow?.count ?? 0;

      if (filter.minRating !== undefined && ratingAvg < filter.minRating) {
        continue;
      }

      // Services performed by staff
      const services = db.all<{ id: string; name: string; price_cents: number }>(
        `SELECT srv.id, srv.name, srv.price_cents
         FROM services srv
         JOIN staff_services ss ON ss.service_id = srv.id
         WHERE ss.staff_id = ? AND srv.status = 'active' AND srv.deleted_at IS NULL`,
        [r.id],
      );

      barbers.push({
        id: r.id,
        shopId: r.shop_id,
        shopName: r.shop_name,
        displayName: r.display_name,
        bio: r.bio,
        avatarUrl: r.avatar_url,
        ratingAvg,
        ratingCount,
        services: services.map((s) => ({ id: s.id, name: s.name, priceCents: s.price_cents })),
      });
    }

    const sortBy = filter.sortBy ?? 'rating';
    barbers.sort((a, b) => {
      if (sortBy === 'name') {
        return a.displayName.localeCompare(b.displayName);
      }
      if (b.ratingAvg !== a.ratingAvg) {
        return b.ratingAvg - a.ratingAvg;
      }
      return b.ratingCount - a.ratingCount;
    });

    const total = barbers.length;
    const items = barbers.slice(offset, offset + limit);

    return { items, total, limit, offset };
  }

  searchServices(filter: ServiceDiscoveryFilter = {}): PaginatedResult<DiscoveredService> {
    const { db } = this.deps;
    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    let query = `
      SELECT srv.id, srv.shop_id, s.name AS shop_name, srv.category_id,
             cat.name AS category_name, srv.name, srv.description,
             srv.duration_minutes, srv.price_cents
      FROM services srv
      JOIN shops s ON s.id = srv.shop_id
      LEFT JOIN service_categories cat ON cat.id = srv.category_id
      WHERE srv.status = 'active' AND srv.deleted_at IS NULL AND s.status = 'active' AND s.deleted_at IS NULL
    `;
    const params: unknown[] = [];

    if (filter.shopId) {
      query += ` AND srv.shop_id = ?`;
      params.push(filter.shopId);
    }
    if (filter.categoryId) {
      query += ` AND srv.category_id = ?`;
      params.push(filter.categoryId);
    }
    if (filter.minPriceCents !== undefined) {
      query += ` AND srv.price_cents >= ?`;
      params.push(filter.minPriceCents);
    }
    if (filter.maxPriceCents !== undefined) {
      query += ` AND srv.price_cents <= ?`;
      params.push(filter.maxPriceCents);
    }
    if (filter.query) {
      const q = `%${filter.query.trim()}%`;
      query += ` AND (srv.name LIKE ? OR srv.description LIKE ? OR s.name LIKE ?)`;
      params.push(q, q, q);
    }

    const sortBy = filter.sortBy ?? 'name';
    switch (sortBy) {
      case 'price_asc':
        query += ` ORDER BY srv.price_cents ASC, srv.name ASC`;
        break;
      case 'price_desc':
        query += ` ORDER BY srv.price_cents DESC, srv.name ASC`;
        break;
      case 'name':
      default:
        query += ` ORDER BY srv.name ASC`;
        break;
    }

    const allRows = db.all<{
      id: string;
      shop_id: string;
      shop_name: string;
      category_id: string | null;
      category_name: string | null;
      name: string;
      description: string | null;
      duration_minutes: number;
      price_cents: number;
    }>(query, params);

    const total = allRows.length;
    const paged = allRows.slice(offset, offset + limit);

    const items: DiscoveredService[] = paged.map((r) => ({
      id: r.id,
      shopId: r.shop_id,
      shopName: r.shop_name,
      categoryId: r.category_id,
      categoryName: r.category_name,
      name: r.name,
      description: r.description,
      durationMinutes: r.duration_minutes,
      priceCents: r.price_cents,
    }));

    return { items, total, limit, offset };
  }
}
