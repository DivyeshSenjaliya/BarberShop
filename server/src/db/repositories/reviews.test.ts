import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { ReviewsRepository } from './reviews';

describe('ReviewsRepository', () => {
  let db: Db;
  let repo: ReviewsRepository;
  let shopId: string;
  let customerId: string;
  let staffId: string;

  beforeEach(() => {
    db = createTestDb();
    repo = new ReviewsRepository(db);

    const ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@shop.com', 'owner@shop.com', 'h', '2026-10-07T00:00:00.000Z',
               'Owner', 'Shop', 'Owner Shop', 'owner')`,
      [ownerId],
    );

    customerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'cust@gmail.com', 'cust@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Customer', 'One', 'Customer One', 'customer')`,
      [customerId],
    );

    shopId = newId('shop');
    db.run(
      `INSERT INTO shops (id, owner_id, name, slug) VALUES (?, ?, 'Crown Barber', 'crown-barber')`,
      [shopId, ownerId],
    );

    staffId = newId('staff');
    db.run(
      `INSERT INTO staff (id, shop_id, employee_code, display_name, status)
       VALUES (?, ?, 'EMP-01', 'Alex Barber', 'active')`,
      [staffId, shopId],
    );
  });

  afterEach(() => db.close());

  it('creates reviews and calculates rating statistics and breakdowns', () => {
    repo.create({
      customerId,
      shopId,
      staffId,
      rating: 5,
      staffRating: 5,
      title: 'Flawless fade',
      comment: 'Best barber in town!',
      images: ['https://example.com/cut1.jpg'],
    });

    const cust2 = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'cust2@gmail.com', 'cust2@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Customer', 'Two', 'Customer Two', 'customer')`,
      [cust2],
    );

    repo.create({
      customerId: cust2,
      shopId,
      staffId,
      rating: 4,
      staffRating: 4,
      title: 'Solid cut',
      comment: 'Clean shop and friendly staff.',
    });

    const stats = repo.getShopRatingStats(shopId);
    expect(stats.totalReviews).toBe(2);
    expect(stats.averageRating).toBe(4.5);
    expect(stats.breakdown[5]).toBe(1);
    expect(stats.breakdown[4]).toBe(1);

    const staffStats = repo.getStaffRatingStats(staffId);
    expect(staffStats.totalReviews).toBe(2);
    expect(staffStats.averageRating).toBe(4.5);
  });

  it('adds owner reply to review', () => {
    const review = repo.create({
      customerId,
      shopId,
      rating: 5,
      comment: 'Amazing place!',
    });

    const updated = repo.addOwnerReply(
      review.id,
      'Thank you Tommy! Looking forward to seeing you again soon.',
    );

    expect(updated.ownerReply).toBe('Thank you Tommy! Looking forward to seeing you again soon.');
    expect(updated.ownerRepliedAt).toBeTruthy();
  });

  it('creates and lists moderation reports', () => {
    const review = repo.create({
      customerId,
      shopId,
      rating: 1,
      comment: 'Inappropriate language',
    });

    const report = repo.createReport({
      reviewId: review.id,
      reporterId: customerId,
      reason: 'inappropriate',
      details: 'Offensive language used in review',
    });

    expect(report.id).toMatch(/^rpt_/);
    expect(report.status).toBe('pending');

    const reports = repo.listReports('pending');
    expect(reports).toHaveLength(1);

    repo.updateReportStatus(report.id, 'reviewed');
    expect(repo.listReports('pending')).toHaveLength(0);
    expect(repo.listReports('reviewed')).toHaveLength(1);
  });
});
