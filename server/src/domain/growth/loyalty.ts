import { BadRequestError } from '../../core/errors';
import type { Logger } from '../../core/logger';
import type { LoyaltyRepository, LoyaltyAccountRecord, LoyaltyTier, LoyaltyTransactionRecord } from '../../db/repositories/loyalty';

export interface LoyaltyServiceDeps {
  loyaltyRepo: LoyaltyRepository;
  logger: Logger;
}

export class LoyaltyService {
  constructor(private readonly deps: LoyaltyServiceDeps) {}

  /**
   * Tier multiplier:
   * - Bronze: 1.0x (10 points per dollar spent)
   * - Silver: 1.25x (12.5 points per dollar)
   * - Gold: 1.5x (15 points per dollar)
   * - Platinum: 2.0x (20 points per dollar)
   */
  getTierMultiplier(tier: LoyaltyTier): number {
    switch (tier) {
      case 'platinum':
        return 2.0;
      case 'gold':
        return 1.5;
      case 'silver':
        return 1.25;
      case 'bronze':
      default:
        return 1.0;
    }
  }

  /**
   * Calculates points earned from completed appointment spend.
   * Base rate: 10 points per 100 cents ($1.00) * tier multiplier.
   */
  calculateEarnedPoints(amountCents: number, tier: LoyaltyTier): number {
    const basePoints = Math.floor(amountCents / 10);
    const multiplier = this.getTierMultiplier(tier);
    return Math.floor(basePoints * multiplier);
  }

  /**
   * Converts loyalty points to discount value in cents.
   * 100 points = 100 cents ($1.00).
   */
  pointsToDiscountCents(points: number): number {
    return Math.floor(points);
  }

  /**
   * Converts discount value in cents to required points.
   * 100 cents = 100 points.
   */
  discountCentsToPoints(discountCents: number): number {
    return Math.ceil(discountCents);
  }

  getAccount(userId: string): LoyaltyAccountRecord {
    return this.deps.loyaltyRepo.getOrCreateAccount(userId);
  }

  listHistory(userId: string, limit = 50, offset = 0): LoyaltyTransactionRecord[] {
    return this.deps.loyaltyRepo.listTransactions(userId, limit, offset);
  }

  awardBookingPoints(
    userId: string,
    appointmentId: string,
    amountCents: number,
  ): { pointsEarned: number; newBalance: number; tier: LoyaltyTier } {
    const account = this.deps.loyaltyRepo.getOrCreateAccount(userId);
    const pointsToAward = this.calculateEarnedPoints(amountCents, account.tier);

    if (pointsToAward <= 0) {
      return {
        pointsEarned: 0,
        newBalance: account.pointsBalance,
        tier: account.tier,
      };
    }

    const { account: updated } = this.deps.loyaltyRepo.creditPoints(
      userId,
      pointsToAward,
      'earned_booking',
      appointmentId,
      `Earned ${pointsToAward} points for completed appointment`,
    );

    this.deps.logger.info('loyalty points awarded for booking', {
      userId,
      appointmentId,
      pointsEarned: pointsToAward,
      newBalance: updated.pointsBalance,
      tier: updated.tier,
    });

    return {
      pointsEarned: pointsToAward,
      newBalance: updated.pointsBalance,
      tier: updated.tier,
    };
  }

  redeemPointsForDiscount(
    userId: string,
    pointsToRedeem: number,
    invoiceId: string,
  ): { discountCents: number; remainingPoints: number } {
    if (pointsToRedeem <= 0) {
      throw new BadRequestError('Points to redeem must be greater than zero');
    }

    const account = this.deps.loyaltyRepo.getOrCreateAccount(userId);
    if (account.pointsBalance < pointsToRedeem) {
      throw new BadRequestError(
        `Insufficient points balance: requested ${pointsToRedeem}, available ${account.pointsBalance}`,
      );
    }

    const discountCents = this.pointsToDiscountCents(pointsToRedeem);

    const { account: updated } = this.deps.loyaltyRepo.debitPoints(
      userId,
      pointsToRedeem,
      'redeemed_discount',
      invoiceId,
      `Redeemed ${pointsToRedeem} points for $${(discountCents / 100).toFixed(2)} discount`,
    );

    this.deps.logger.info('loyalty points redeemed for discount', {
      userId,
      invoiceId,
      pointsRedeemed: pointsToRedeem,
      discountCents,
      remainingPoints: updated.pointsBalance,
    });

    return {
      discountCents,
      remainingPoints: updated.pointsBalance,
    };
  }
}
