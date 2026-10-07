import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors';
import type { Logger } from '../../core/logger';
import type { CouponsRepository, CouponRecord, DiscountType } from '../../db/repositories/coupons';
import type { BookingsRepository } from '../../db/repositories/bookings';

export interface ValidateCouponInput {
  code: string;
  userId: string;
  subtotalCents: number;
  shopId?: string;
  serviceIds?: string[];
}

export interface CouponValidationResult {
  valid: boolean;
  coupon: CouponRecord;
  discountCents: number;
  message?: string;
}

export interface ApplyCouponInput {
  code: string;
  userId: string;
  subtotalCents: number;
  shopId?: string;
  serviceIds?: string[];
  appointmentId?: string | null;
  invoiceId?: string | null;
}

export interface PromotionsServiceDeps {
  couponsRepo: CouponsRepository;
  bookingsRepo?: BookingsRepository;
  logger: Logger;
}

export class PromotionsService {
  constructor(private readonly deps: PromotionsServiceDeps) {}

  calculateDiscount(
    discountType: DiscountType,
    discountValue: number,
    subtotalCents: number,
    maxDiscountCents: number | null,
  ): number {
    let discount = 0;
    if (discountType === 'percentage') {
      // discountValue is in basis points (100 = 1%, 2000 = 20%)
      discount = Math.round((subtotalCents * discountValue) / 10000);
    } else {
      // fixed amount in cents
      discount = discountValue;
    }

    if (maxDiscountCents !== null && maxDiscountCents > 0) {
      discount = Math.min(discount, maxDiscountCents);
    }

    return Math.min(discount, subtotalCents);
  }

  validateCoupon(input: ValidateCouponInput): CouponValidationResult {
    const coupon = this.deps.couponsRepo.findByCode(input.code);
    if (!coupon) {
      throw new NotFoundError('Coupon', input.code);
    }

    if (!coupon.isActive) {
      throw new BadRequestError(`Coupon '${coupon.code}' is no longer active`);
    }

    const now = new Date().toISOString();
    if (now < coupon.startsAt) {
      throw new BadRequestError(`Coupon '${coupon.code}' has not started yet`);
    }
    if (now > coupon.expiresAt) {
      throw new BadRequestError(`Coupon '${coupon.code}' has expired`);
    }

    if (coupon.usageLimit !== null && coupon.timesUsed >= coupon.usageLimit) {
      throw new ConflictError(`Coupon '${coupon.code}' has reached its maximum total usage limit`);
    }

    const userRedemptions = this.deps.couponsRepo.countRedemptionsByUser(coupon.id, input.userId);
    if (userRedemptions >= coupon.perUserLimit) {
      throw new ConflictError(
        `You have already used coupon '${coupon.code}' the maximum allowed number of times (${coupon.perUserLimit})`,
      );
    }

    if (coupon.shopId && input.shopId && coupon.shopId !== input.shopId) {
      throw new BadRequestError(`Coupon '${coupon.code}' is only valid at a specific shop`);
    }

    if (coupon.serviceId && input.serviceIds && input.serviceIds.length > 0) {
      if (!input.serviceIds.includes(coupon.serviceId)) {
        throw new BadRequestError(`Coupon '${coupon.code}' is only valid for specific services`);
      }
    }

    if (input.subtotalCents < coupon.minOrderCents) {
      const minDollar = (coupon.minOrderCents / 100).toFixed(2);
      throw new BadRequestError(
        `Minimum order amount for coupon '${coupon.code}' is $${minDollar}`,
      );
    }

    if (coupon.firstBookingOnly && this.deps.bookingsRepo) {
      const priorCount = this.deps.bookingsRepo.count({
        customerId: input.userId,
        status: ['confirmed', 'in_progress', 'completed'],
      });
      if (priorCount > 0) {
        throw new BadRequestError(
          `Coupon '${coupon.code}' is only valid for your first appointment`,
        );
      }
    }

    const discountCents = this.calculateDiscount(
      coupon.discountType,
      coupon.discountValue,
      input.subtotalCents,
      coupon.maxDiscountCents,
    );

    return {
      valid: true,
      coupon,
      discountCents,
    };
  }

  applyCoupon(input: ApplyCouponInput): { coupon: CouponRecord; discountCents: number } {
    const { coupon, discountCents } = this.validateCoupon({
      code: input.code,
      userId: input.userId,
      subtotalCents: input.subtotalCents,
      shopId: input.shopId,
      serviceIds: input.serviceIds,
    });

    this.deps.couponsRepo.recordRedemption({
      couponId: coupon.id,
      userId: input.userId,
      appointmentId: input.appointmentId,
      invoiceId: input.invoiceId,
      discountCents,
    });

    this.deps.logger.info('coupon applied successfully', {
      couponCode: coupon.code,
      userId: input.userId,
      discountCents,
      invoiceId: input.invoiceId,
    });

    return { coupon, discountCents };
  }
}
