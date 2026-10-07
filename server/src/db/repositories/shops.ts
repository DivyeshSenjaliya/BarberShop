import { newId } from '../../core/ids';
import type { Db } from '../sqlite';

export type ShopStatus = 'draft' | 'pending' | 'active' | 'suspended' | 'closed';
export type BranchStatus = 'active' | 'temporarily_closed' | 'closed';

export interface ShopRecord {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string;
  currency: string;
  logoUrl: string | null;
  coverUrl: string | null;
  status: ShopStatus;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ShopRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string;
  currency: string;
  logo_url: string | null;
  cover_url: string | null;
  status: ShopStatus;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BranchRecord {
  id: string;
  shopId: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  timezone: string | null;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface BranchRow {
  id: string;
  shop_id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string | null;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  timezone: string | null;
  status: BranchStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BusinessHoursRecord {
  id: string;
  branchId: string;
  weekday: number;
  opensAt: string | null;
  closesAt: string | null;
  closed: boolean;
  validFrom: string;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BusinessHoursRow {
  id: string;
  branch_id: string;
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  closed: number;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface HolidayRecord {
  id: string;
  branchId: string;
  holidayDate: string;
  name: string;
  recurring: boolean;
  createdAt: string;
  deletedAt: string | null;
}

interface HolidayRow {
  id: string;
  branch_id: string;
  holiday_date: string;
  name: string;
  recurring: number;
  created_at: string;
  deleted_at: string | null;
}

function mapShopRow(row: ShopRow): ShopRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    phone: row.phone,
    email: row.email,
    website: row.website,
    timezone: row.timezone,
    currency: row.currency,
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    status: row.status,
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapBranchRow(row: BranchRow): BranchRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    region: row.region,
    postalCode: row.postal_code,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    timezone: row.timezone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapBusinessHoursRow(row: BusinessHoursRow): BusinessHoursRecord {
  return {
    id: row.id,
    branchId: row.branch_id,
    weekday: row.weekday,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    closed: row.closed === 1,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHolidayRow(row: HolidayRow): HolidayRecord {
  return {
    id: row.id,
    branchId: row.branch_id,
    holidayDate: row.holiday_date,
    name: row.name,
    recurring: row.recurring === 1,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

const ShopSelectColumns = `
  id, owner_id, name, slug, description, phone, email, website,
  timezone, currency, logo_url, cover_url, status, rating_avg, rating_count,
  created_at, updated_at, deleted_at`;

const BranchSelectColumns = `
  id, shop_id, name, address_line1, address_line2, city, region,
  postal_code, country, latitude, longitude, phone, timezone, status,
  created_at, updated_at, deleted_at`;

const BusinessHoursSelectColumns = `
  id, branch_id, weekday, opens_at, closes_at, closed, valid_from, valid_until,
  created_at, updated_at`;

const HolidaySelectColumns = `
  id, branch_id, holiday_date, name, recurring, created_at, deleted_at`;

export interface CreateShopInput {
  id?: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  timezone?: string;
  currency?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  status?: ShopStatus;
}

export interface UpdateShopInput {
  name?: string;
  slug?: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  timezone?: string;
  currency?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  status?: ShopStatus;
}

export interface CreateBranchInput {
  id?: string;
  shopId: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  timezone?: string | null;
  status?: BranchStatus;
}

export interface UpdateBranchInput {
  name?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  region?: string | null;
  postalCode?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  timezone?: string | null;
  status?: BranchStatus;
}

export interface SetBusinessHoursInput {
  id?: string;
  weekday: number;
  opensAt?: string | null;
  closesAt?: string | null;
  closed?: boolean;
  validFrom?: string;
  validUntil?: string | null;
}

export interface CreateHolidayInput {
  id?: string;
  branchId: string;
  holidayDate: string;
  name: string;
  recurring?: boolean;
}

export class ShopsRepository {
  constructor(private readonly db: Db) {}

  // ---------------------------------------------------------------------------
  // Shops
  // ---------------------------------------------------------------------------

  findShopById(id: string, options: { includeDeleted?: boolean } = {}): ShopRecord | null {
    const row = this.db.get<ShopRow>(
      `SELECT ${ShopSelectColumns} FROM shops WHERE id = ?${options.includeDeleted ? '' : ' AND deleted_at IS NULL'}`,
      [id],
    );
    return row ? mapShopRow(row) : null;
  }

  requireShopById(id: string): ShopRecord {
    const shop = this.findShopById(id);
    if (!shop) throw new Error(`shop '${id}' not found`);
    return shop;
  }

  findShopBySlug(slug: string, options: { includeDeleted?: boolean } = {}): ShopRecord | null {
    const row = this.db.get<ShopRow>(
      `SELECT ${ShopSelectColumns} FROM shops WHERE slug = ?${options.includeDeleted ? '' : ' AND deleted_at IS NULL'}`,
      [slug.trim().toLowerCase()],
    );
    return row ? mapShopRow(row) : null;
  }

  slugExists(slug: string): boolean {
    return (
      this.db.get('SELECT 1 AS present FROM shops WHERE slug = ? AND deleted_at IS NULL', [
        slug.trim().toLowerCase(),
      ]) !== undefined
    );
  }

  listShops(
    options: {
      ownerId?: string;
      status?: ShopStatus;
      includeDeleted?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): ShopRecord[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (!options.includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }
    if (options.ownerId) {
      clauses.push('owner_id = ?');
      params.push(options.ownerId);
    }
    if (options.status) {
      clauses.push('status = ?');
      params.push(options.status);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limitClause = options.limit !== undefined ? `LIMIT ${options.limit} OFFSET ${options.offset ?? 0}` : '';

    return this.db
      .all<ShopRow>(`SELECT ${ShopSelectColumns} FROM shops ${where} ORDER BY created_at DESC, id DESC ${limitClause}`, params)
      .map(mapShopRow);
  }

  countShops(options: { ownerId?: string; status?: ShopStatus; includeDeleted?: boolean } = {}): number {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (!options.includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }
    if (options.ownerId) {
      clauses.push('owner_id = ?');
      params.push(options.ownerId);
    }
    if (options.status) {
      clauses.push('status = ?');
      params.push(options.status);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const row = this.db.get<{ count: number }>(`SELECT COUNT(*) AS count FROM shops ${where}`, params);
    return row?.count ?? 0;
  }

  createShop(input: CreateShopInput): ShopRecord {
    const id = input.id ?? newId('shop');
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO shops (
         id, owner_id, name, slug, description, phone, email, website,
         timezone, currency, logo_url, cover_url, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.ownerId,
        input.name.trim(),
        input.slug.trim().toLowerCase(),
        input.description ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.website ?? null,
        input.timezone ?? 'UTC',
        input.currency ?? 'USD',
        input.logoUrl ?? null,
        input.coverUrl ?? null,
        input.status ?? 'draft',
        now,
        now,
      ],
    );
    return this.requireShopById(id);
  }

  updateShop(id: string, patch: UpdateShopInput): ShopRecord {
    const fields: string[] = [];
    const values: unknown[] = [];

    const set = (column: string, value: unknown): void => {
      fields.push(`${column} = ?`);
      values.push(value);
    };

    if (patch.name !== undefined) set('name', patch.name.trim());
    if (patch.slug !== undefined) set('slug', patch.slug.trim().toLowerCase());
    if (patch.description !== undefined) set('description', patch.description);
    if (patch.phone !== undefined) set('phone', patch.phone);
    if (patch.email !== undefined) set('email', patch.email);
    if (patch.website !== undefined) set('website', patch.website);
    if (patch.timezone !== undefined) set('timezone', patch.timezone);
    if (patch.currency !== undefined) set('currency', patch.currency);
    if (patch.logoUrl !== undefined) set('logo_url', patch.logoUrl);
    if (patch.coverUrl !== undefined) set('cover_url', patch.coverUrl);
    if (patch.status !== undefined) set('status', patch.status);

    if (fields.length > 0) {
      set('updated_at', new Date().toISOString());
      values.push(id);
      this.db.run(`UPDATE shops SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values);
    }

    return this.requireShopById(id);
  }

  updateRating(id: string, ratingAvg: number, ratingCount: number): ShopRecord {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE shops SET rating_avg = ?, rating_count = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [ratingAvg, ratingCount, now, id],
    );
    return this.requireShopById(id);
  }

  softDeleteShop(id: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE shops SET deleted_at = ?, status = 'closed', updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
  }

  // ---------------------------------------------------------------------------
  // Branches
  // ---------------------------------------------------------------------------

  findBranchById(id: string, options: { includeDeleted?: boolean } = {}): BranchRecord | null {
    const row = this.db.get<BranchRow>(
      `SELECT ${BranchSelectColumns} FROM branches WHERE id = ?${options.includeDeleted ? '' : ' AND deleted_at IS NULL'}`,
      [id],
    );
    return row ? mapBranchRow(row) : null;
  }

  requireBranchById(id: string): BranchRecord {
    const branch = this.findBranchById(id);
    if (!branch) throw new Error(`branch '${id}' not found`);
    return branch;
  }

  listBranchesForShop(
    shopId: string,
    options: { status?: BranchStatus; includeDeleted?: boolean } = {},
  ): BranchRecord[] {
    const clauses: string[] = ['shop_id = ?'];
    const params: unknown[] = [shopId];

    if (!options.includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }
    if (options.status) {
      clauses.push('status = ?');
      params.push(options.status);
    }

    return this.db
      .all<BranchRow>(
        `SELECT ${BranchSelectColumns} FROM branches WHERE ${clauses.join(' AND ')} ORDER BY created_at ASC, id ASC`,
        params,
      )
      .map(mapBranchRow);
  }

  createBranch(input: CreateBranchInput): BranchRecord {
    const id = input.id ?? newId('brch');
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO branches (
         id, shop_id, name, address_line1, address_line2, city, region,
         postal_code, country, latitude, longitude, phone, timezone, status,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.shopId,
        input.name.trim(),
        input.addressLine1.trim(),
        input.addressLine2?.trim() ?? null,
        input.city.trim(),
        input.region?.trim() ?? null,
        input.postalCode.trim(),
        input.country ?? 'US',
        input.latitude ?? null,
        input.longitude ?? null,
        input.phone?.trim() ?? null,
        input.timezone ?? null,
        input.status ?? 'active',
        now,
        now,
      ],
    );
    return this.requireBranchById(id);
  }

  updateBranch(id: string, patch: UpdateBranchInput): BranchRecord {
    const fields: string[] = [];
    const values: unknown[] = [];

    const set = (column: string, value: unknown): void => {
      fields.push(`${column} = ?`);
      values.push(value);
    };

    if (patch.name !== undefined) set('name', patch.name.trim());
    if (patch.addressLine1 !== undefined) set('address_line1', patch.addressLine1.trim());
    if (patch.addressLine2 !== undefined) set('address_line2', patch.addressLine2?.trim() ?? null);
    if (patch.city !== undefined) set('city', patch.city.trim());
    if (patch.region !== undefined) set('region', patch.region?.trim() ?? null);
    if (patch.postalCode !== undefined) set('postal_code', patch.postalCode.trim());
    if (patch.country !== undefined) set('country', patch.country);
    if (patch.latitude !== undefined) set('latitude', patch.latitude);
    if (patch.longitude !== undefined) set('longitude', patch.longitude);
    if (patch.phone !== undefined) set('phone', patch.phone?.trim() ?? null);
    if (patch.timezone !== undefined) set('timezone', patch.timezone);
    if (patch.status !== undefined) set('status', patch.status);

    if (fields.length > 0) {
      set('updated_at', new Date().toISOString());
      values.push(id);
      this.db.run(`UPDATE branches SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values);
    }

    return this.requireBranchById(id);
  }

  softDeleteBranch(id: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE branches SET deleted_at = ?, status = 'closed', updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
  }

  // ---------------------------------------------------------------------------
  // Business Hours
  // ---------------------------------------------------------------------------

  listBusinessHours(branchId: string): BusinessHoursRecord[] {
    return this.db
      .all<BusinessHoursRow>(
        `SELECT ${BusinessHoursSelectColumns} FROM business_hours WHERE branch_id = ? ORDER BY weekday ASC, valid_from ASC`,
        [branchId],
      )
      .map(mapBusinessHoursRow);
  }

  setBusinessHours(branchId: string, hours: SetBusinessHoursInput[]): BusinessHoursRecord[] {
    this.db.transaction(() => {
      // Clear existing hours for this branch
      this.db.run('DELETE FROM business_hours WHERE branch_id = ?', [branchId]);

      const now = new Date().toISOString();
      for (const h of hours) {
        const id = h.id ?? newId('sched');
        const closed = h.closed ? 1 : 0;
        this.db.run(
          `INSERT INTO business_hours (
             id, branch_id, weekday, opens_at, closes_at, closed, valid_from, valid_until,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            branchId,
            h.weekday,
            closed ? null : (h.opensAt ?? null),
            closed ? null : (h.closesAt ?? null),
            closed,
            h.validFrom ?? '1970-01-01',
            h.validUntil ?? null,
            now,
            now,
          ],
        );
      }
    });

    return this.listBusinessHours(branchId);
  }

  // ---------------------------------------------------------------------------
  // Holidays
  // ---------------------------------------------------------------------------

  listHolidays(branchId: string, options: { includeDeleted?: boolean } = {}): HolidayRecord[] {
    return this.db
      .all<HolidayRow>(
        `SELECT ${HolidaySelectColumns} FROM holidays WHERE branch_id = ?${options.includeDeleted ? '' : ' AND deleted_at IS NULL'} ORDER BY holiday_date ASC`,
        [branchId],
      )
      .map(mapHolidayRow);
  }

  addHoliday(input: CreateHolidayInput): HolidayRecord {
    const id = input.id ?? newId('sched');
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO holidays (id, branch_id, holiday_date, name, recurring, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.branchId, input.holidayDate, input.name.trim(), input.recurring ? 1 : 0, now],
    );
    const row = this.db.get<HolidayRow>(`SELECT ${HolidaySelectColumns} FROM holidays WHERE id = ?`, [id]);
    if (!row) throw new Error(`holiday ${id} disappeared immediately after insert`);
    return mapHolidayRow(row);
  }

  deleteHoliday(id: string): void {
    const now = new Date().toISOString();
    this.db.run(`UPDATE holidays SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`, [now, id]);
  }

  isHoliday(branchId: string, date: string): boolean {
    const dayAndMonth = date.slice(5); // e.g. "12-25"
    const row = this.db.get<{ present: number }>(
      `SELECT 1 AS present FROM holidays
       WHERE branch_id = ? AND deleted_at IS NULL
         AND (holiday_date = ? OR (recurring = 1 AND holiday_date LIKE ?))
       LIMIT 1`,
      [branchId, date, `%-${dayAndMonth}`],
    );
    return row !== undefined;
  }
}
