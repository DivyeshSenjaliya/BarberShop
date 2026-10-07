import { newId } from '../../core/ids';
import type { Db } from '../sqlite';

export type ServicePriceType = 'fixed' | 'from' | 'custom';
export type ServiceStatus = 'active' | 'inactive';

export interface ServiceCategoryRecord {
  id: string;
  shopId: string | null;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface CategoryRow {
  id: string;
  shop_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ServiceRecord {
  id: string;
  shopId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
  priceType: ServicePriceType;
  status: ServiceStatus;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ServiceRow {
  id: string;
  shop_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  price_cents: number;
  price_type: ServicePriceType;
  status: ServiceStatus;
  image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BranchServiceRecord {
  branchId: string;
  serviceId: string;
  enabled: boolean;
  priceCents: number | null;
  createdAt: string;
}

interface BranchServiceRow {
  branch_id: string;
  service_id: string;
  enabled: number;
  price_cents: number | null;
  created_at: string;
}

export interface BranchEffectiveServiceRecord extends ServiceRecord {
  effectivePriceCents: number;
  branchEnabled: boolean;
  hasPriceOverride: boolean;
}

function mapCategoryRow(row: CategoryRow): ServiceCategoryRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    iconUrl: row.icon_url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapServiceRow(row: ServiceRow): ServiceRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    durationMinutes: row.duration_minutes,
    bufferMinutes: row.buffer_minutes,
    priceCents: row.price_cents,
    priceType: row.price_type,
    status: row.status,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapBranchServiceRow(row: BranchServiceRow): BranchServiceRecord {
  return {
    branchId: row.branch_id,
    serviceId: row.service_id,
    enabled: row.enabled === 1,
    priceCents: row.price_cents,
    createdAt: row.created_at,
  };
}

const CategorySelectColumns = `
  id, shop_id, name, slug, description, icon_url, sort_order,
  created_at, updated_at, deleted_at`;

const ServiceSelectColumns = `
  id, shop_id, category_id, name, slug, description, duration_minutes,
  buffer_minutes, price_cents, price_type, status, image_url, sort_order,
  created_at, updated_at, deleted_at`;

const BranchServiceSelectColumns = `
  branch_id, service_id, enabled, price_cents, created_at`;

export interface CreateCategoryInput {
  id?: string;
  shopId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  iconUrl?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  iconUrl?: string | null;
  sortOrder?: number;
}

export interface CreateServiceInput {
  id?: string;
  shopId: string;
  categoryId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  durationMinutes: number;
  bufferMinutes?: number;
  priceCents: number;
  priceType?: ServicePriceType;
  status?: ServiceStatus;
  imageUrl?: string | null;
  sortOrder?: number;
}

export interface UpdateServiceInput {
  categoryId?: string | null;
  name?: string;
  slug?: string;
  description?: string | null;
  durationMinutes?: number;
  bufferMinutes?: number;
  priceCents?: number;
  priceType?: ServicePriceType;
  status?: ServiceStatus;
  imageUrl?: string | null;
  sortOrder?: number;
}

export interface ConfigureBranchServiceInput {
  branchId: string;
  serviceId: string;
  enabled?: boolean;
  priceCents?: number | null;
}

export class ServicesRepository {
  constructor(private readonly db: Db) {}

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  findCategoryById(id: string, options: { includeDeleted?: boolean } = {}): ServiceCategoryRecord | null {
    const row = this.db.get<CategoryRow>(
      `SELECT ${CategorySelectColumns} FROM service_categories WHERE id = ?${options.includeDeleted ? '' : ' AND deleted_at IS NULL'}`,
      [id],
    );
    return row ? mapCategoryRow(row) : null;
  }

  requireCategoryById(id: string): ServiceCategoryRecord {
    const category = this.findCategoryById(id);
    if (!category) throw new Error(`category '${id}' not found`);
    return category;
  }

  listCategories(
    options: {
      shopId?: string | null;
      includePlatform?: boolean;
      includeDeleted?: boolean;
    } = {},
  ): ServiceCategoryRecord[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (!options.includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }

    if (options.shopId !== undefined) {
      if (options.includePlatform) {
        clauses.push('(shop_id = ? OR shop_id IS NULL)');
        params.push(options.shopId);
      } else if (options.shopId === null) {
        clauses.push('shop_id IS NULL');
      } else {
        clauses.push('shop_id = ?');
        params.push(options.shopId);
      }
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return this.db
      .all<CategoryRow>(
        `SELECT ${CategorySelectColumns} FROM service_categories ${where} ORDER BY sort_order ASC, name ASC`,
        params,
      )
      .map(mapCategoryRow);
  }

  createCategory(input: CreateCategoryInput): ServiceCategoryRecord {
    const id = input.id ?? newId('cat');
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO service_categories (
         id, shop_id, name, slug, description, icon_url, sort_order, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.shopId ?? null,
        input.name.trim(),
        input.slug.trim().toLowerCase(),
        input.description ?? null,
        input.iconUrl ?? null,
        input.sortOrder ?? 0,
        now,
        now,
      ],
    );
    return this.requireCategoryById(id);
  }

  updateCategory(id: string, patch: UpdateCategoryInput): ServiceCategoryRecord {
    const fields: string[] = [];
    const values: unknown[] = [];

    const set = (col: string, val: unknown): void => {
      fields.push(`${col} = ?`);
      values.push(val);
    };

    if (patch.name !== undefined) set('name', patch.name.trim());
    if (patch.slug !== undefined) set('slug', patch.slug.trim().toLowerCase());
    if (patch.description !== undefined) set('description', patch.description);
    if (patch.iconUrl !== undefined) set('icon_url', patch.iconUrl);
    if (patch.sortOrder !== undefined) set('sort_order', patch.sortOrder);

    if (fields.length > 0) {
      set('updated_at', new Date().toISOString());
      values.push(id);
      this.db.run(`UPDATE service_categories SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values);
    }

    return this.requireCategoryById(id);
  }

  softDeleteCategory(id: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE service_categories SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
  }

  // ---------------------------------------------------------------------------
  // Services
  // ---------------------------------------------------------------------------

  findServiceById(id: string, options: { includeDeleted?: boolean } = {}): ServiceRecord | null {
    const row = this.db.get<ServiceRow>(
      `SELECT ${ServiceSelectColumns} FROM services WHERE id = ?${options.includeDeleted ? '' : ' AND deleted_at IS NULL'}`,
      [id],
    );
    return row ? mapServiceRow(row) : null;
  }

  requireServiceById(id: string): ServiceRecord {
    const service = this.findServiceById(id);
    if (!service) throw new Error(`service '${id}' not found`);
    return service;
  }

  findServiceBySlug(shopId: string, slug: string): ServiceRecord | null {
    const row = this.db.get<ServiceRow>(
      `SELECT ${ServiceSelectColumns} FROM services WHERE shop_id = ? AND slug = ? AND deleted_at IS NULL`,
      [shopId, slug.trim().toLowerCase()],
    );
    return row ? mapServiceRow(row) : null;
  }

  listServices(
    options: {
      shopId: string;
      categoryId?: string | null;
      status?: ServiceStatus;
      includeDeleted?: boolean;
    },
  ): ServiceRecord[] {
    const clauses: string[] = ['shop_id = ?'];
    const params: unknown[] = [options.shopId];

    if (!options.includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }
    if (options.categoryId !== undefined) {
      if (options.categoryId === null) {
        clauses.push('category_id IS NULL');
      } else {
        clauses.push('category_id = ?');
        params.push(options.categoryId);
      }
    }
    if (options.status) {
      clauses.push('status = ?');
      params.push(options.status);
    }

    return this.db
      .all<ServiceRow>(
        `SELECT ${ServiceSelectColumns} FROM services WHERE ${clauses.join(' AND ')} ORDER BY sort_order ASC, name ASC`,
        params,
      )
      .map(mapServiceRow);
  }

  createService(input: CreateServiceInput): ServiceRecord {
    const id = input.id ?? newId('srv');
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO services (
         id, shop_id, category_id, name, slug, description, duration_minutes,
         buffer_minutes, price_cents, price_type, status, image_url, sort_order,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.shopId,
        input.categoryId ?? null,
        input.name.trim(),
        input.slug.trim().toLowerCase(),
        input.description ?? null,
        input.durationMinutes,
        input.bufferMinutes ?? 0,
        input.priceCents,
        input.priceType ?? 'fixed',
        input.status ?? 'active',
        input.imageUrl ?? null,
        input.sortOrder ?? 0,
        now,
        now,
      ],
    );
    return this.requireServiceById(id);
  }

  updateService(id: string, patch: UpdateServiceInput): ServiceRecord {
    const fields: string[] = [];
    const values: unknown[] = [];

    const set = (col: string, val: unknown): void => {
      fields.push(`${col} = ?`);
      values.push(val);
    };

    if (patch.categoryId !== undefined) set('category_id', patch.categoryId);
    if (patch.name !== undefined) set('name', patch.name.trim());
    if (patch.slug !== undefined) set('slug', patch.slug.trim().toLowerCase());
    if (patch.description !== undefined) set('description', patch.description);
    if (patch.durationMinutes !== undefined) set('duration_minutes', patch.durationMinutes);
    if (patch.bufferMinutes !== undefined) set('buffer_minutes', patch.bufferMinutes);
    if (patch.priceCents !== undefined) set('price_cents', patch.priceCents);
    if (patch.priceType !== undefined) set('price_type', patch.priceType);
    if (patch.status !== undefined) set('status', patch.status);
    if (patch.imageUrl !== undefined) set('image_url', patch.imageUrl);
    if (patch.sortOrder !== undefined) set('sort_order', patch.sortOrder);

    if (fields.length > 0) {
      set('updated_at', new Date().toISOString());
      values.push(id);
      this.db.run(`UPDATE services SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values);
    }

    return this.requireServiceById(id);
  }

  softDeleteService(id: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE services SET deleted_at = ?, status = 'inactive', updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
  }

  // ---------------------------------------------------------------------------
  // Branch Services (Availability & Price Overrides)
  // ---------------------------------------------------------------------------

  getBranchService(branchId: string, serviceId: string): BranchServiceRecord | null {
    const row = this.db.get<BranchServiceRow>(
      `SELECT ${BranchServiceSelectColumns} FROM branch_services WHERE branch_id = ? AND service_id = ?`,
      [branchId, serviceId],
    );
    return row ? mapBranchServiceRow(row) : null;
  }

  configureBranchService(input: ConfigureBranchServiceInput): BranchServiceRecord {
    const now = new Date().toISOString();
    const enabled = input.enabled !== false ? 1 : 0;
    const priceCents = input.priceCents ?? null;

    this.db.run(
      `INSERT INTO branch_services (branch_id, service_id, enabled, price_cents, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (branch_id, service_id) DO UPDATE SET
         enabled = excluded.enabled,
         price_cents = excluded.price_cents`,
      [input.branchId, input.serviceId, enabled, priceCents, now],
    );

    const record = this.getBranchService(input.branchId, input.serviceId);
    if (!record) throw new Error(`branch service ${input.branchId}/${input.serviceId} disappeared after insert`);
    return record;
  }

  listServicesForBranch(
    branchId: string,
    options: { enabledOnly?: boolean } = {},
  ): BranchEffectiveServiceRecord[] {
    interface JoinedRow extends ServiceRow {
      branch_enabled: number | null;
      override_price_cents: number | null;
    }

    const rows = this.db.all<JoinedRow>(
      `SELECT s.id, s.shop_id, s.category_id, s.name, s.slug, s.description, s.duration_minutes,
              s.buffer_minutes, s.price_cents, s.price_type, s.status, s.image_url, s.sort_order,
              s.created_at, s.updated_at, s.deleted_at,
              bs.enabled AS branch_enabled,
              bs.price_cents AS override_price_cents
       FROM branches b
       JOIN services s ON s.shop_id = b.shop_id AND s.deleted_at IS NULL AND s.status = 'active'
       LEFT JOIN branch_services bs ON bs.branch_id = b.id AND bs.service_id = s.id
       WHERE b.id = ? AND b.deleted_at IS NULL
       ORDER BY s.sort_order ASC, s.name ASC`,
      [branchId],
    );

    const results: BranchEffectiveServiceRecord[] = [];

    for (const row of rows) {
      // By default, if no branch_service row exists, the service is enabled at base price.
      // If a row exists, bs.enabled controls it.
      const branchEnabled = row.branch_enabled === null ? true : row.branch_enabled === 1;
      if (options.enabledOnly && !branchEnabled) {
        continue;
      }

      const hasPriceOverride = row.override_price_cents !== null;
      const effectivePriceCents = hasPriceOverride ? row.override_price_cents! : row.price_cents;

      results.push({
        ...mapServiceRow(row),
        branchEnabled,
        effectivePriceCents,
        hasPriceOverride,
      });
    }

    return results;
  }
}
