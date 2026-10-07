import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../core/config';
import type { Logger } from '../../core/logger';
import type { Db } from '../../db/sqlite';
import type { CouponsRepository } from '../../db/repositories/coupons';
import type { FavoritesRepository, FavoriteTargetType } from '../../db/repositories/favorites';
import type { LoyaltyService } from '../../domain/growth/loyalty';
import type { NotificationsService } from '../../domain/growth/notifications';
import type { PromotionsService } from '../../domain/growth/promotions';
import type { ReviewsService } from '../../domain/growth/reviews';
import { asyncHandler } from '../asyncHandler';
import { authenticate, currentPrincipal, requireAuth, requirePermission } from '../middleware/auth';
import { sendCreated, sendNoContent, sendOk } from '../responses';
import { parseBody, parseQuery } from '../validate';

export interface GrowthRouterDeps {
  db: Db;
  config: AppConfig;
  logger: Logger;
  promotions: PromotionsService;
  loyalty: LoyaltyService;
  reviews: ReviewsService;
  notifications: NotificationsService;
  favoritesRepo: FavoritesRepository;
  couponsRepo: CouponsRepository;
}

// Schemas
const CreateCouponSchema = z.object({
  shopId: z.string().optional(),
  code: z.string().trim().min(3).max(32),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().int().min(1),
  minOrderCents: z.number().int().min(0).default(0),
  maxDiscountCents: z.number().int().min(1).nullish(),
  usageLimit: z.number().int().min(1).nullish(),
  perUserLimit: z.number().int().min(1).default(1),
  firstBookingOnly: z.boolean().default(false),
  serviceId: z.string().nullish(),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

const ValidateCouponSchema = z.object({
  code: z.string().trim().min(1),
  subtotalCents: z.number().int().min(1),
  shopId: z.string().optional(),
  serviceIds: z.array(z.string()).optional(),
});

const CreateReviewSchema = z.object({
  appointmentId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  staffRating: z.number().int().min(1).max(5).optional(),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().min(5).max(2000),
  images: z.array(z.string().url()).max(5).optional(),
});

const ReplyReviewSchema = z.object({
  reply: z.string().trim().min(2).max(1000),
});

const ReportReviewSchema = z.object({
  reason: z.enum(['spam', 'inappropriate', 'harassment', 'fake', 'other']),
  details: z.string().trim().max(500).optional(),
});

const AddFavoriteSchema = z.object({
  targetType: z.enum(['shop', 'barber']),
  targetId: z.string().min(1),
});

const UpdatePreferencesSchema = z.object({
  emailBookingUpdates: z.boolean().optional(),
  emailReminders: z.boolean().optional(),
  emailPromotions: z.boolean().optional(),
  pushBookingUpdates: z.boolean().optional(),
  pushReminders: z.boolean().optional(),
  pushPromotions: z.boolean().optional(),
  smsBookingUpdates: z.boolean().optional(),
});

export function createGrowthRouter(deps: GrowthRouterDeps): Router {
  const router = Router();
  const auth = authenticate(deps);
  const { promotions, loyalty, reviews, notifications, favoritesRepo, couponsRepo } = deps;

  // ---------------------------------------------------------------------------
  // Coupons & Promotions
  // ---------------------------------------------------------------------------

  router.post(
    '/coupons',
    auth,
    requirePermission('coupon:manage'),
    asyncHandler((req, res) => {
      const body = parseBody(CreateCouponSchema, req);
      const coupon = couponsRepo.create({
        ...body,
        maxDiscountCents: body.maxDiscountCents ?? null,
        usageLimit: body.usageLimit ?? null,
        serviceId: body.serviceId ?? null,
      });
      sendCreated(res, { coupon });
    }),
  );

  router.get(
    '/coupons',
    auth,
    asyncHandler((req, res) => {
      const query = parseQuery(
        z.object({ shopId: z.string().optional(), isActive: z.coerce.boolean().optional() }),
        req,
      );
      const coupons = couponsRepo.list({
        shopId: query.shopId,
        isActive: query.isActive,
        includeGlobal: true,
      });
      sendOk(res, { coupons });
    }),
  );

  router.post(
    '/coupons/validate',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const body = parseBody(ValidateCouponSchema, req);
      const principal = currentPrincipal(res);
      const result = promotions.validateCoupon({
        ...body,
        userId: principal.userId,
      });
      sendOk(res, result);
    }),
  );

  // ---------------------------------------------------------------------------
  // Loyalty
  // ---------------------------------------------------------------------------

  router.get(
    '/loyalty',
    auth,
    requireAuth(),
    asyncHandler((_req, res) => {
      const principal = currentPrincipal(res);
      const account = loyalty.getAccount(principal.userId);
      sendOk(res, { loyalty: account });
    }),
  );

  router.get(
    '/loyalty/history',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const principal = currentPrincipal(res);
      const query = parseQuery(
        z.object({ limit: z.coerce.number().optional(), offset: z.coerce.number().optional() }),
        req,
      );
      const transactions = loyalty.listHistory(principal.userId, query.limit, query.offset);
      sendOk(res, { transactions });
    }),
  );

  // ---------------------------------------------------------------------------
  // Reviews & Ratings
  // ---------------------------------------------------------------------------

  router.post(
    '/reviews',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const body = parseBody(CreateReviewSchema, req);
      const principal = currentPrincipal(res);
      const review = reviews.createReview({
        ...body,
        customerId: principal.userId,
      });
      sendCreated(res, { review });
    }),
  );

  router.get(
    '/reviews/shop/:shopId',
    asyncHandler((req, res) => {
      const query = parseQuery(
        z.object({ limit: z.coerce.number().optional(), offset: z.coerce.number().optional() }),
        req,
      );
      const list = reviews.listReviews({
        shopId: req.params.shopId,
        limit: query.limit,
        offset: query.offset,
      });
      const stats = reviews.getShopStats(req.params.shopId!);
      sendOk(res, { reviews: list, stats });
    }),
  );

  router.get(
    '/reviews/staff/:staffId',
    asyncHandler((req, res) => {
      const query = parseQuery(
        z.object({ limit: z.coerce.number().optional(), offset: z.coerce.number().optional() }),
        req,
      );
      const list = reviews.listReviews({
        staffId: req.params.staffId,
        limit: query.limit,
        offset: query.offset,
      });
      const stats = reviews.getStaffStats(req.params.staffId!);
      sendOk(res, { reviews: list, stats });
    }),
  );

  router.post(
    '/reviews/:reviewId/reply',
    auth,
    requirePermission('review:respond'),
    asyncHandler((req, res) => {
      const body = parseBody(ReplyReviewSchema, req);
      const principal = currentPrincipal(res);
      const review = reviews.replyToReview(principal.userId, req.params.reviewId!, body.reply);
      sendOk(res, { review });
    }),
  );

  router.post(
    '/reviews/:reviewId/report',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const body = parseBody(ReportReviewSchema, req);
      const principal = currentPrincipal(res);
      const report = reviews.reportReview(
        principal.userId,
        req.params.reviewId!,
        body.reason,
        body.details,
      );
      sendCreated(res, { report });
    }),
  );

  // ---------------------------------------------------------------------------
  // Customer Favorites
  // ---------------------------------------------------------------------------

  router.get(
    '/favorites',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const principal = currentPrincipal(res);
      const query = parseQuery(
        z.object({ targetType: z.enum(['shop', 'barber']).optional() }),
        req,
      );
      const favorites = favoritesRepo.listByUser(principal.userId, query.targetType);
      sendOk(res, { favorites });
    }),
  );

  router.post(
    '/favorites',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const body = parseBody(AddFavoriteSchema, req);
      const principal = currentPrincipal(res);
      const favorite = favoritesRepo.add(principal.userId, body.targetType, body.targetId);
      sendCreated(res, { favorite });
    }),
  );

  router.delete(
    '/favorites/:targetType/:targetId',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const principal = currentPrincipal(res);
      const targetType = req.params.targetType as FavoriteTargetType;
      const targetId = req.params.targetId!;
      favoritesRepo.remove(principal.userId, targetType, targetId);
      sendNoContent(res);
    }),
  );

  // ---------------------------------------------------------------------------
  // Notifications & Preferences
  // ---------------------------------------------------------------------------

  router.get(
    '/notifications',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const principal = currentPrincipal(res);
      const query = parseQuery(
        z.object({
          unreadOnly: z.coerce.boolean().optional(),
          limit: z.coerce.number().optional(),
          offset: z.coerce.number().optional(),
        }),
        req,
      );
      const list = notifications.listNotifications(
        principal.userId,
        query.unreadOnly,
        query.limit,
        query.offset,
      );
      const unreadCount = notifications.getUnreadCount(principal.userId);
      sendOk(res, { notifications: list, unreadCount });
    }),
  );

  router.post(
    '/notifications/:id/read',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const principal = currentPrincipal(res);
      notifications.markRead(req.params.id!, principal.userId);
      sendOk(res, { success: true });
    }),
  );

  router.post(
    '/notifications/read-all',
    auth,
    requireAuth(),
    asyncHandler((_req, res) => {
      const principal = currentPrincipal(res);
      const count = notifications.markAllRead(principal.userId);
      sendOk(res, { markedCount: count });
    }),
  );

  router.get(
    '/notifications/preferences',
    auth,
    requireAuth(),
    asyncHandler((_req, res) => {
      const principal = currentPrincipal(res);
      const preferences = notifications.getPreferences(principal.userId);
      sendOk(res, { preferences });
    }),
  );

  router.patch(
    '/notifications/preferences',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const body = parseBody(UpdatePreferencesSchema, req);
      const principal = currentPrincipal(res);
      const preferences = notifications.updatePreferences(principal.userId, body);
      sendOk(res, { preferences });
    }),
  );

  return router;
}
