import { newId } from '../../core/ids';
import type { Db } from '../sqlite';

export type DiscountType = 'percentage' | 'fixed';

export interface CouponRecord {
  id: string;
  shopId: string | null;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderCents: number;
  maxDiscountCents: number | null;
  usageLimit: number | null;
  perUserLimit: number;
  timesUsed: number;
  firstBookingOnly: boolean;
  serviceId: string | null;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CouponRow {
  id: string;
  shop_id: string | null;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_cents: number;
  max_discount_cents: number | null;
  usage_limit: number | null;
  per_user_limit: number;
  times_used: number;
  first_booking_only: number;
  service_id: string | null;
  starts_at: string;
  expires_at: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CouponRedemptionRecord {
  id: string;
  couponId: string;
  userId: string;
  appointmentId: string | null;
  invoiceId: string | null;
  discountCents: number;
  redeemedAt: string;
}

interface CouponRedemptionRow {
  id: string;
  coupon_id: string;
  user_id: string;
  appointment_id: string | null;
  invoice_id: string | null;
  discount_cents: number;
  redeemed_at: string;
}

function mapCouponRow(row: CouponRow): CouponRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minOrderCents: row.min_order_cents,
    maxDiscountCents: row.max_discount_cents,
    usageLimit: row.usage_limit,
    perUserLimit: row.per_user_limit,
    timesUsed: row.times_used,
    firstBookingOnly: row.first_booking_only === 1,
    serviceId: row.service_id,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRedemptionRow(row: CouponRedemptionRow): CouponRedemptionRecord {
  return {
    id: row.id,
    couponId: row.coupon_id,
    userId: row.user_id,
    appointmentId: row.appointment_id,
    invoiceId: row.invoice_id,
    discountCents: row.discount_cents,
    redeemedAt: row.redeemed_at,
  };
}

const CouponColumns = `
  id, shop_id, code, discount_type, discount_value, min_order_cents,
  max_discount_cents, usage_limit, per_user_limit, times_used, first_booking_only,
  service_id, starts_at, expires_at, is_active, created_at, updated_at`;

const RedemptionColumns = `
  id, coupon_id, user_id, appointment_id, invoice_id, discount_cents, redeemed_at`;

export interface CreateCouponInput {
  id?: string;
  shopId?: string | null;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderCents?: number;
  maxDiscountCents?: number | null;
  usageLimit?: number | null;
  perUserLimit?: number;
  firstBookingOnly?: boolean;
  serviceId?: string | null;
  startsAt: string;
  expiresAt: string;
  isActive?: boolean;
}

export interface ListCouponsFilter {
  shopId?: string | null;
  isActive?: boolean;
  includeGlobal?: boolean;
}

export class CouponsRepository {
  constructor(private readonly db: Db) {}

  findById(id: string): CouponRecord | null {
    const row = this.db.get<CouponRow>(
      `SELECT ${CouponColumns} FROM coupons WHERE id = ?`,
      [id],
    );
    return row ? mapCouponRow(row) : null;
  }

  findByCode(code: string): CouponRecord | null {
    const row = this.db.get<CouponRow>(
      `SELECT ${CouponColumns} FROM coupons WHERE UPPER(code) = UPPER(?)`,
      [code.trim()],
    );
    return row ? mapCouponRow(row) : null;
  }

  create(input: CreateCouponInput): CouponRecord {
    const id = input.id ?? newId('coup');
    const now = new Date().toISOString();
    const code = input.code.trim().toUpperCase();

    this.db.run(
      `INSERT INTO coupons (
         id, shop_id, code, discount_type, discount_value, min_order_cents,
         max_discount_cents, usage_limit, per_user_limit, times_used, first_booking_only,
         service_id, starts_at, expires_at, is_active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.shopId ?? null,
        code,
        input.discountType,
        input.discountValue,
        input.minOrderCents ?? 0,
        input.maxDiscountCents ?? null,
        input.usageLimit ?? null,
        input.perUserLimit ?? 1,
        input.firstBookingOnly ? 1 : 0,
        input.serviceId ?? null,
        input.startsAt,
        input.expiresAt,
        input.isActive ?? true ? 1 : 0,
        now,
        now,
      ],
    );

    return this.findById(id)!;
  }

  list(filter: ListCouponsFilter = {}): CouponRecord[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filter.isActive !== undefined) {
      clauses.push('is_active = ?');
      params.push(filter.isActive ? 1 : 0);
    }

    if (filter.shopId !== undefined) {
      if (filter.includeGlobal) {
        clauses.push('(shop_id = ? OR shop_id IS NULL)');
        params.push(filter.shopId);
      } else if (filter.shopId === null) {
        clauses.push('shop_id IS NULL');
      } else {
        clauses.push('shop_id = ?');
        params.push(filter.shopId);
      }
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return this.db
      .all<CouponRow>(`SELECT ${CouponColumns} FROM coupons ${where} ORDER BY created_at DESC`, params)
      .map(mapCouponRow);
  }

  deactivate(id: string): void {
    const now = new Date().toISOString();
    this.db.run(`UPDATE coupons SET is_active = 0, updated_at = ? WHERE id = ?`, [now, id]);
  }

  recordRedemption(input: {
    couponId: string;
    userId: string;
    appointmentId?: string | null;
    invoiceId?: string | null;
    discountCents: number;
  }): CouponRedemptionRecord {
    const id = newId('rdm');
    const now = new Date().toISOString();

    return this.db.transaction(() => {
      this.db.run(
        `INSERT INTO coupon_redemptions (
           id, coupon_id, user_id, appointment_id, invoice_id, discount_cents, redeemed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.couponId,
          input.userId,
          input.appointmentId ?? null,
          input.invoiceId ?? null,
          input.discountCents,
          now,
        ],
      );

      this.db.run(
        `UPDATE coupons SET times_used = times_used + 1, updated_at = ? WHERE id = ?`,
        [now, input.couponId],
      );

      const row = this.db.get<CouponRedemptionRow>(
        `SELECT ${RedemptionColumns} FROM coupon_redemptions WHERE id = ?`,
        [id],
      );
      return mapRedemptionRow(row!);
    });
  }

  countRedemptionsByUser(couponId: string, userId: string): number {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?`,
      [couponId, userId],
    );
    return row?.count ?? 0;
  }

  listUserRedemptions(userId: string): CouponRedemptionRecord[] {
    return this.db
      .all<CouponRedemptionRow>(
        `SELECT ${RedemptionColumns} FROM coupon_redemptions WHERE user_id = ? ORDER BY redeemed_at DESC`,
        [userId],
      )
      .map(mapRedemptionRow);
  }
}
