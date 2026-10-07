import { newId } from '../../core/ids';
import { createTestDb, createTestLogger } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { ReviewsRepository } from '../../db/repositories/reviews';
import { BookingsRepository } from '../../db/repositories/bookings';
import { ShopsRepository } from '../../db/repositories/shops';
import { ReviewsService } from './reviews';

describe('ReviewsService', () => {
  let db: Db;
  let reviewsRepo: ReviewsRepository;
  let bookingsRepo: BookingsRepository;
  let shopsRepo: ShopsRepository;
  let service: ReviewsService;
  let shopId: string;
  let branchId: string;
  let customerId: string;
  let staffId: string;
  let ownerId: string;

  beforeEach(() => {
    db = createTestDb();
    reviewsRepo = new ReviewsRepository(db);
    bookingsRepo = new BookingsRepository(db);
    shopsRepo = new ShopsRepository(db);

    service = new ReviewsService({
      reviewsRepo,
      bookingsRepo,
      shopsRepo,
      logger: createTestLogger(),
    });

    ownerId = newId('usr');
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

    branchId = newId('brch');
    db.run(
      `INSERT INTO branches (id, shop_id, name, address_line1, city, postal_code)
       VALUES (?, ?, 'Downtown', '123 Main St', 'NY', '10001')`,
      [branchId, shopId],
    );

    staffId = newId('staff');
    db.run(
      `INSERT INTO staff (id, shop_id, employee_code, display_name, status)
       VALUES (?, ?, 'EMP-01', 'Alex Barber', 'active')`,
      [staffId, shopId],
    );

    const srvId = newId('srv');
    db.run(
      `INSERT INTO services (id, shop_id, name, slug, duration_minutes, price_cents)
       VALUES (?, ?, 'Haircut', 'haircut', 30, 3500)`,
      [srvId, shopId],
    );
  });

  afterEach(() => db.close());

  function createCompletedAppointment(cust: string): string {
    const srv = db.get<{ id: string }>(`SELECT id FROM services WHERE shop_id = ?`, [shopId]);
    const apt = bookingsRepo.create(
      {
        shopId,
        branchId,
        customerId: cust,
        staffId,
        appointmentDate: '2026-10-10',
        startsAt: '2026-10-10T10:00:00.000Z',
        endsAt: '2026-10-10T10:30:00.000Z',
        durationMinutes: 30,
        totalPriceCents: 3500,
        status: 'completed',
      },
      [
        {
          serviceId: srv!.id,
          serviceName: 'Haircut',
          durationMinutes: 30,
          priceCents: 3500,
        },
      ],
    );
    return apt.id;
  }

  it('allows verified customer with completed appointment to submit review', () => {
    const aptId = createCompletedAppointment(customerId);

    const review = service.createReview({
      appointmentId: aptId,
      customerId,
      rating: 5,
      staffRating: 5,
      title: 'Top notch service',
      comment: 'Very professional, clean fade!',
    });

    expect(review.id).toMatch(/^rev_/);
    expect(review.rating).toBe(5);
    expect(review.isVerifiedBooking).toBe(true);

    const stats = service.getShopStats(shopId);
    expect(stats.totalReviews).toBe(1);
    expect(stats.averageRating).toBe(5);
  });

  it('prevents customer from reviewing another customer appointment', () => {
    const otherUser = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'other@gmail.com', 'other@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Other', 'User', 'Other User', 'customer')`,
      [otherUser],
    );

    const aptId = createCompletedAppointment(otherUser);

    expect(() =>
      service.createReview({
        appointmentId: aptId,
        customerId, // wrong customer
        rating: 5,
        comment: 'Great cut',
      }),
    ).toThrow(/only review appointments that you attended/i);
  });

  it('prevents duplicate reviews for the same appointment', () => {
    const aptId = createCompletedAppointment(customerId);

    service.createReview({
      appointmentId: aptId,
      customerId,
      rating: 5,
      comment: 'First review',
    });

    expect(() =>
      service.createReview({
        appointmentId: aptId,
        customerId,
        rating: 4,
        comment: 'Second review attempt',
      }),
    ).toThrow(/already submitted a review/i);
  });

  it('allows shop owner to reply to review', () => {
    const aptId = createCompletedAppointment(customerId);
    const review = service.createReview({
      appointmentId: aptId,
      customerId,
      rating: 5,
      comment: 'Loved the experience!',
    });

    const replied = service.replyToReview(ownerId, review.id, 'Thanks for coming by!');
    expect(replied.ownerReply).toBe('Thanks for coming by!');
  });
});
