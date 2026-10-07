import { newId } from '../../core/ids';
import type { Db } from '../sqlite';

export type ReviewStatus = 'published' | 'under_review' | 'hidden' | 'flagged';
export type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'fake' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

export interface ReviewRecord {
  id: string;
  appointmentId: string | null;
  customerId: string;
  shopId: string;
  staffId: string | null;
  rating: number;
  staffRating: number | null;
  title: string | null;
  comment: string;
  images: string[];
  status: ReviewStatus;
  ownerReply: string | null;
  ownerRepliedAt: string | null;
  isVerifiedBooking: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReviewRow {
  id: string;
  appointment_id: string | null;
  customer_id: string;
  shop_id: string;
  staff_id: string | null;
  rating: number;
  staff_rating: number | null;
  title: string | null;
  comment: string;
  images_json: string | null;
  status: ReviewStatus;
  owner_reply: string | null;
  owner_replied_at: string | null;
  is_verified_booking: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewReportRecord {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
}

interface ReviewReportRow {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface RatingStats {
  averageRating: number;
  totalReviews: number;
  breakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

function mapReviewRow(row: ReviewRow): ReviewRecord {
  let images: string[] = [];
  if (row.images_json) {
    try {
      images = JSON.parse(row.images_json);
    } catch {
      images = [];
    }
  }

  return {
    id: row.id,
    appointmentId: row.appointment_id,
    customerId: row.customer_id,
    shopId: row.shop_id,
    staffId: row.staff_id,
    rating: row.rating,
    staffRating: row.staff_rating,
    title: row.title,
    comment: row.comment,
    images,
    status: row.status,
    ownerReply: row.owner_reply,
    ownerRepliedAt: row.owner_replied_at,
    isVerifiedBooking: row.is_verified_booking === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReportRow(row: ReviewReportRow): ReviewReportRecord {
  return {
    id: row.id,
    reviewId: row.review_id,
    reporterId: row.reporter_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
  };
}

const ReviewColumns = `
  id, appointment_id, customer_id, shop_id, staff_id, rating, staff_rating,
  title, comment, images_json, status, owner_reply, owner_replied_at,
  is_verified_booking, created_at, updated_at`;

const ReportColumns = `
  id, review_id, reporter_id, reason, details, status, created_at`;

export interface CreateReviewInput {
  id?: string;
  appointmentId?: string | null;
  customerId: string;
  shopId: string;
  staffId?: string | null;
  rating: number;
  staffRating?: number | null;
  title?: string | null;
  comment: string;
  images?: string[];
  isVerifiedBooking?: boolean;
}

export interface ListReviewsFilter {
  shopId?: string;
  staffId?: string;
  customerId?: string;
  status?: ReviewStatus;
  limit?: number;
  offset?: number;
}

export class ReviewsRepository {
  constructor(private readonly db: Db) {}

  findById(id: string): ReviewRecord | null {
    const row = this.db.get<ReviewRow>(
      `SELECT ${ReviewColumns} FROM reviews WHERE id = ?`,
      [id],
    );
    return row ? mapReviewRow(row) : null;
  }

  findByAppointmentId(appointmentId: string): ReviewRecord | null {
    const row = this.db.get<ReviewRow>(
      `SELECT ${ReviewColumns} FROM reviews WHERE appointment_id = ?`,
      [appointmentId],
    );
    return row ? mapReviewRow(row) : null;
  }

  create(input: CreateReviewInput): ReviewRecord {
    const id = input.id ?? newId('rev');
    const now = new Date().toISOString();
    const imagesJson = input.images && input.images.length > 0 ? JSON.stringify(input.images) : null;

    this.db.run(
      `INSERT INTO reviews (
         id, appointment_id, customer_id, shop_id, staff_id, rating, staff_rating,
         title, comment, images_json, status, is_verified_booking, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`,
      [
        id,
        input.appointmentId ?? null,
        input.customerId,
        input.shopId,
        input.staffId ?? null,
        input.rating,
        input.staffRating ?? null,
        input.title ?? null,
        input.comment,
        imagesJson,
        input.isVerifiedBooking ?? true ? 1 : 0,
        now,
        now,
      ],
    );

    return this.findById(id)!;
  }

  list(filter: ListReviewsFilter = {}): ReviewRecord[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filter.shopId) {
      clauses.push('shop_id = ?');
      params.push(filter.shopId);
    }
    if (filter.staffId) {
      clauses.push('staff_id = ?');
      params.push(filter.staffId);
    }
    if (filter.customerId) {
      clauses.push('customer_id = ?');
      params.push(filter.customerId);
    }
    if (filter.status) {
      clauses.push('status = ?');
      params.push(filter.status);
    } else {
      // By default list only published reviews
      clauses.push("status = 'published'");
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = filter.limit !== undefined ? `LIMIT ${filter.limit} OFFSET ${filter.offset ?? 0}` : '';

    return this.db
      .all<ReviewRow>(
        `SELECT ${ReviewColumns} FROM reviews ${where} ORDER BY created_at DESC ${limit}`,
        params,
      )
      .map(mapReviewRow);
  }

  getShopRatingStats(shopId: string): RatingStats {
    const rows = this.db.all<{ rating: number; count: number }>(
      `SELECT rating, COUNT(*) AS count
       FROM reviews
       WHERE shop_id = ? AND status = 'published'
       GROUP BY rating`,
      [shopId],
    );

    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalScore = 0;
    let totalReviews = 0;

    for (const r of rows) {
      const star = r.rating as 1 | 2 | 3 | 4 | 5;
      if (breakdown[star] !== undefined) {
        breakdown[star] = r.count;
        totalScore += star * r.count;
        totalReviews += r.count;
      }
    }

    const averageRating = totalReviews > 0 ? Math.round((totalScore / totalReviews) * 10) / 10 : 0;
    return { averageRating, totalReviews, breakdown };
  }

  getStaffRatingStats(staffId: string): RatingStats {
    const rows = this.db.all<{ staff_rating: number; count: number }>(
      `SELECT staff_rating, COUNT(*) AS count
       FROM reviews
       WHERE staff_id = ? AND staff_rating IS NOT NULL AND status = 'published'
       GROUP BY staff_rating`,
      [staffId],
    );

    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalScore = 0;
    let totalReviews = 0;

    for (const r of rows) {
      const star = r.staff_rating as 1 | 2 | 3 | 4 | 5;
      if (breakdown[star] !== undefined) {
        breakdown[star] = r.count;
        totalScore += star * r.count;
        totalReviews += r.count;
      }
    }

    const averageRating = totalReviews > 0 ? Math.round((totalScore / totalReviews) * 10) / 10 : 0;
    return { averageRating, totalReviews, breakdown };
  }

  addOwnerReply(reviewId: string, reply: string): ReviewRecord {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE reviews
       SET owner_reply = ?,
           owner_replied_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [reply.trim(), now, now, reviewId],
    );
    return this.findById(reviewId)!;
  }

  updateStatus(reviewId: string, status: ReviewStatus): ReviewRecord {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE reviews SET status = ?, updated_at = ? WHERE id = ?`,
      [status, now, reviewId],
    );
    return this.findById(reviewId)!;
  }

  createReport(input: {
    reviewId: string;
    reporterId: string;
    reason: ReportReason;
    details?: string | null;
  }): ReviewReportRecord {
    const id = newId('rpt');
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO review_reports (
         id, review_id, reporter_id, reason, details, status, created_at
       ) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [id, input.reviewId, input.reporterId, input.reason, input.details ?? null, now],
    );

    const row = this.db.get<ReviewReportRow>(
      `SELECT ${ReportColumns} FROM review_reports WHERE id = ?`,
      [id],
    );
    return mapReportRow(row!);
  }

  listReports(status?: ReportStatus): ReviewReportRecord[] {
    const where = status ? 'WHERE status = ?' : '';
    const params = status ? [status] : [];
    return this.db
      .all<ReviewReportRow>(
        `SELECT ${ReportColumns} FROM review_reports ${where} ORDER BY created_at DESC`,
        params,
      )
      .map(mapReportRow);
  }

  updateReportStatus(reportId: string, status: ReportStatus): void {
    this.db.run(`UPDATE review_reports SET status = ? WHERE id = ?`, [status, reportId]);
  }
}
