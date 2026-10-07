import { newId } from '../../core/ids';
import { createTestDb, createTestLogger } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { AnalyticsService } from './service';

describe('AnalyticsService', () => {
  let db: Db;
  let service: AnalyticsService;
  let shopId: string;
  let staffId: string;
  let customer1Id: string;
  let customer2Id: string;
  let serviceId: string;

  beforeEach(() => {
    db = createTestDb();
    service = new AnalyticsService({
      db,
      logger: createTestLogger(),
    });

    const ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@analytics.com', 'owner@analytics.com', 'h', '2026-10-07T00:00:00.000Z',
               'Owner', 'Analytics', 'Owner Analytics', 'owner')`,
      [ownerId],
    );

    customer1Id = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'c1@analytics.com', 'c1@analytics.com', 'h', '2026-10-07T00:00:00.000Z',
               'Cust', 'One', 'Customer One', 'customer')`,
      [customer1Id],
    );

    customer2Id = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'c2@analytics.com', 'c2@analytics.com', 'h', '2026-10-07T00:00:00.000Z',
               'Cust', 'Two', 'Customer Two', 'customer')`,
      [customer2Id],
    );

    shopId = newId('shop');
    db.run(
      `INSERT INTO shops (id, owner_id, name, slug, status)
       VALUES (?, ?, 'Analytics Barber Co', 'analytics-barber-co', 'active')`,
      [shopId, ownerId],
    );

    const branchId = newId('brch');
    db.run(
      `INSERT INTO branches (id, shop_id, name, address_line1, city, postal_code, status)
       VALUES (?, ?, 'Main', '100 Main St', 'NY', '10001', 'active')`,
      [branchId, shopId],
    );

    // Staff with 40% commission (4000 bps)
    staffId = newId('staff');
    db.run(
      `INSERT INTO staff (id, shop_id, employee_code, display_name, status, commission_bps)
       VALUES (?, ?, 'EMP-01', 'Top Barber', 'active', 4000)`,
      [staffId, shopId],
    );

    serviceId = newId('srv');
    db.run(
      `INSERT INTO services (id, shop_id, name, slug, duration_minutes, price_cents, status)
       VALUES (?, ?, 'Fade & Beard', 'fade-and-beard', 45, 5000, 'active')`,
      [serviceId, shopId],
    );

    // Create 2 completed appointments for customer 1
    const apt1Id = newId('bkd');
    db.run(
      `INSERT INTO appointments (id, shop_id, branch_id, customer_id, staff_id, status, appointment_date, starts_at, ends_at, duration_minutes, total_price_cents)
       VALUES (?, ?, ?, ?, ?, 'completed', '2026-10-15', '2026-10-15T10:00:00.000Z', '2026-10-15T10:45:00.000Z', 45, 5000)`,
      [apt1Id, shopId, branchId, customer1Id, staffId],
    );

    db.run(
      `INSERT INTO appointment_services (id, appointment_id, service_id, service_name, duration_minutes, price_cents, sort_order)
       VALUES (?, ?, ?, 'Fade & Beard', 45, 5000, 0)`,
      [newId('srv'), apt1Id, serviceId],
    );

    const apt2Id = newId('bkd');
    db.run(
      `INSERT INTO appointments (id, shop_id, branch_id, customer_id, staff_id, status, appointment_date, starts_at, ends_at, duration_minutes, total_price_cents)
       VALUES (?, ?, ?, ?, ?, 'completed', '2026-10-16', '2026-10-16T11:00:00.000Z', '2026-10-16T11:45:00.000Z', 45, 5000)`,
      [apt2Id, shopId, branchId, customer1Id, staffId],
    );

    db.run(
      `INSERT INTO appointment_services (id, appointment_id, service_id, service_name, duration_minutes, price_cents, sort_order)
       VALUES (?, ?, ?, 'Fade & Beard', 45, 5000, 0)`,
      [newId('srv'), apt2Id, serviceId],
    );

    // Create 1 cancelled appointment for customer 2
    const apt3Id = newId('bkd');
    db.run(
      `INSERT INTO appointments (id, shop_id, branch_id, customer_id, staff_id, status, appointment_date, starts_at, ends_at, duration_minutes, total_price_cents)
       VALUES (?, ?, ?, ?, ?, 'cancelled', '2026-10-17', '2026-10-17T12:00:00.000Z', '2026-10-17T12:45:00.000Z', 45, 5000)`,
      [apt3Id, shopId, branchId, customer2Id, staffId],
    );

    // Payments: $50.00 each for apt1 and apt2, $10.00 refund on apt1
    const pay1Id = newId('pay');
    db.run(
      `INSERT INTO payments (id, appointment_id, customer_id, shop_id, amount_cents, method, status, created_at)
       VALUES (?, ?, ?, ?, 5000, 'card', 'successful', '2026-10-15T10:50:00.000Z')`,
      [pay1Id, apt1Id, customer1Id, shopId],
    );

    const pay2Id = newId('pay');
    db.run(
      `INSERT INTO payments (id, appointment_id, customer_id, shop_id, amount_cents, method, status, created_at)
       VALUES (?, ?, ?, ?, 5000, 'card', 'successful', '2026-10-16T11:50:00.000Z')`,
      [pay2Id, apt2Id, customer1Id, shopId],
    );

    const ref1Id = newId('rfnd');
    db.run(
      `INSERT INTO refunds (id, payment_id, requested_by, amount_cents, reason, status, created_at)
       VALUES (?, ?, ?, 1000, 'Customer satisfaction', 'processed', '2026-10-15T12:00:00.000Z')`,
      [ref1Id, pay1Id, ownerId],
    );
  });

  afterEach(() => db.close());

  it('calculates shop revenue, refunds, and daily trend accurately', () => {
    const rev = service.getShopRevenueOverview(shopId);

    expect(rev.grossRevenueCents).toBe(10000); // 2 * $50
    expect(rev.refundsCents).toBe(1000); // $10 refund
    expect(rev.netRevenueCents).toBe(9000); // $90 net
    expect(rev.successfulPaymentsCount).toBe(2);
    expect(rev.averageTicketCents).toBe(5000);
    expect(rev.dailyTrend).toHaveLength(2);
  });

  it('calculates booking statistics and conversion rates', () => {
    const stats = service.getShopBookingStats(shopId);

    expect(stats.totalAppointments).toBe(3);
    expect(stats.completedCount).toBe(2);
    expect(stats.cancelledCount).toBe(1);
    expect(stats.completionRatePercent).toBe(66.7);
    expect(stats.cancellationRatePercent).toBe(33.3);
  });

  it('determines customer statistics with repeat vs new breakdown', () => {
    const custStats = service.getShopCustomerStats(shopId);

    expect(custStats.uniqueCustomersCount).toBe(2);
    expect(custStats.repeatCustomersCount).toBe(1); // customer 1 has 2 bookings
    expect(custStats.newCustomersCount).toBe(1); // customer 2 has 1 booking
  });

  it('tracks staff performance and calculates commission earnings', () => {
    const staffStats = service.getStaffPerformanceStats(shopId);

    expect(staffStats).toHaveLength(1);
    expect(staffStats[0]!.displayName).toBe('Top Barber');
    expect(staffStats[0]!.completedAppointmentsCount).toBe(2);
    expect(staffStats[0]!.grossRevenueCents).toBe(10000);
    // 40% of 10000 = 4000 cents ($40.00)
    expect(staffStats[0]!.commissionEarnedCents).toBe(4000);

    const earnings = service.getStaffEarnings(staffId);
    expect(earnings.commissionRatePercent).toBe(40);
    expect(earnings.grossRevenueCents).toBe(10000);
    expect(earnings.commissionEarnedCents).toBe(4000);
    expect(earnings.recentBookings).toHaveLength(2);
    expect(earnings.recentBookings[0]!.commissionCents).toBe(2000);
  });

  it('ranks popular services by bookings and gross revenue', () => {
    const popular = service.getPopularServices(shopId);

    expect(popular).toHaveLength(1);
    expect(popular[0]!.serviceName).toBe('Fade & Beard');
    expect(popular[0]!.bookingsCount).toBe(2);
    expect(popular[0]!.grossRevenueCents).toBe(10000);
  });
});
