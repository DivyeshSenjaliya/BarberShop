import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors';
import type { Logger } from '../../core/logger';
import type { BookingsRepository } from '../../db/repositories/bookings';
import type { ShopsRepository } from '../../db/repositories/shops';
import type {
  ReviewsRepository,
  ReviewRecord,
  ReviewReportRecord,
  RatingStats,
  ReportReason,
  ReviewStatus,
} from '../../db/repositories/reviews';

export interface CreateReviewDomainInput {
  appointmentId: string;
  customerId: string;
  rating: number;
  staffRating?: number;
  title?: string;
  comment: string;
  images?: string[];
}

export interface ReviewsServiceDeps {
  reviewsRepo: ReviewsRepository;
  bookingsRepo: BookingsRepository;
  shopsRepo: ShopsRepository;
  logger: Logger;
}

export class ReviewsService {
  constructor(private readonly deps: ReviewsServiceDeps) {}

  createReview(input: CreateReviewDomainInput): ReviewRecord {
    // 1. Verify appointment exists
    const apt = this.deps.bookingsRepo.findById(input.appointmentId);
    if (!apt) {
      throw new NotFoundError('Appointment', input.appointmentId);
    }

    // 2. Verify appointment belongs to customer
    if (apt.customerId !== input.customerId) {
      throw new ForbiddenError('You can only review appointments that you attended');
    }

    // 3. Verify appointment is completed
    if (apt.status !== 'completed') {
      throw new BadRequestError('You can only review completed appointments');
    }

    // 4. Verify no duplicate review exists
    const existing = this.deps.reviewsRepo.findByAppointmentId(input.appointmentId);
    if (existing) {
      throw new ConflictError('You have already submitted a review for this appointment');
    }

    // 5. Rating validation (1-5)
    if (input.rating < 1 || input.rating > 5) {
      throw new BadRequestError('Rating must be between 1 and 5 stars');
    }
    if (input.staffRating !== undefined && (input.staffRating < 1 || input.staffRating > 5)) {
      throw new BadRequestError('Barber rating must be between 1 and 5 stars');
    }

    // 6. Comment validation
    if (!input.comment || input.comment.trim().length < 5) {
      throw new BadRequestError('Review comment must be at least 5 characters long');
    }

    const review = this.deps.reviewsRepo.create({
      appointmentId: input.appointmentId,
      customerId: input.customerId,
      shopId: apt.shopId,
      staffId: apt.staffId,
      rating: input.rating,
      staffRating: input.staffRating,
      title: input.title?.trim() || null,
      comment: input.comment.trim(),
      images: input.images,
      isVerifiedBooking: true,
    });

    this.deps.logger.info('review created for appointment', {
      reviewId: review.id,
      shopId: apt.shopId,
      staffId: apt.staffId,
      rating: review.rating,
    });

    return review;
  }

  getReview(id: string): ReviewRecord {
    const review = this.deps.reviewsRepo.findById(id);
    if (!review) {
      throw new NotFoundError('Review', id);
    }
    return review;
  }

  listReviews(filter: { shopId?: string; staffId?: string; customerId?: string; limit?: number; offset?: number }): ReviewRecord[] {
    return this.deps.reviewsRepo.list(filter);
  }

  getShopStats(shopId: string): RatingStats {
    return this.deps.reviewsRepo.getShopRatingStats(shopId);
  }

  getStaffStats(staffId: string): RatingStats {
    return this.deps.reviewsRepo.getStaffRatingStats(staffId);
  }

  replyToReview(ownerUserId: string, reviewId: string, reply: string): ReviewRecord {
    const review = this.getReview(reviewId);
    const shop = this.deps.shopsRepo.findShopById(review.shopId);

    if (!shop || shop.ownerId !== ownerUserId) {
      throw new ForbiddenError('Only the shop owner can reply to reviews on this shop');
    }

    if (!reply || reply.trim().length < 2) {
      throw new BadRequestError('Reply message cannot be empty');
    }

    return this.deps.reviewsRepo.addOwnerReply(reviewId, reply.trim());
  }

  reportReview(reporterId: string, reviewId: string, reason: ReportReason, details?: string): ReviewReportRecord {
    this.getReview(reviewId); // ensure exists
    return this.deps.reviewsRepo.createReport({
      reviewId,
      reporterId,
      reason,
      details,
    });
  }

  moderateReview(adminOrStaffUserId: string, reviewId: string, status: ReviewStatus): ReviewRecord {
    this.getReview(reviewId);
    this.deps.logger.info('review status updated by moderator', { reviewId, status, moderatorId: adminOrStaffUserId });
    return this.deps.reviewsRepo.updateStatus(reviewId, status);
  }
}
