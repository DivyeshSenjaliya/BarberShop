import type { Db } from '../../db/sqlite';
import type { Logger } from '../../core/logger';
import { NotFoundError } from '../../core/errors';

export interface RevenueOverview {
  grossRevenueCents: number;
  refundsCents: number;
  netRevenueCents: number;
  successfulPaymentsCount: number;
  averageTicketCents: number;
  dailyTrend: { date: string; revenueCents: number }[];
}

export interface BookingStats {
  totalAppointments: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  confirmedCount: number;
  completionRatePercent: number;
  cancellationRatePercent: number;
  noShowRatePercent: number;
}

export interface CustomerStats {
  uniqueCustomersCount: number;
  repeatCustomersCount: number;
  newCustomersCount: number;
}

export interface StaffPerformanceItem {
  staffId: string;
  displayName: string;
  employeeCode: string;
  commissionBps: number;
  completedAppointmentsCount: number;
  grossRevenueCents: number;
  commissionEarnedCents: number;
  ratingAvg: number;
  ratingCount: number;
}

export interface PopularServiceItem {
  serviceId: string;
  serviceName: string;
  bookingsCount: number;
  grossRevenueCents: number;
}

export interface StaffEarningsOverview {
  staffId: string;
  displayName: string;
  commissionBps: number;
  commissionRatePercent: number;
  completedAppointmentsCount: number;
  grossRevenueCents: number;
  commissionEarnedCents: number;
  recentBookings: {
    appointmentId: string;
    appointmentDate: string;
    serviceName: string;
    priceCents: number;
    commissionCents: number;
  }[];
}

export interface AnalyticsServiceDeps {
  db: Db;
  logger: Logger;
}

export class AnalyticsService {
  constructor(private readonly deps: AnalyticsServiceDeps) {}

  getShopRevenueOverview(
    shopId: string,
    fromDate?: string,
    toDate?: string,
  ): RevenueOverview {
    const { db } = this.deps;
    const dateClauses: string[] = ['p.shop_id = ?', "p.status = 'successful'"];
    const params: unknown[] = [shopId];

    if (fromDate) {
      dateClauses.push('p.created_at >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      dateClauses.push('p.created_at <= ?');
      params.push(toDate);
    }

    const where = `WHERE ${dateClauses.join(' AND ')}`;

    // Total gross payments
    const payRow = db.get<{ total: number | null; count: number }>(
      `SELECT SUM(p.amount_cents) AS total, COUNT(*) AS count
       FROM payments p
       ${where}`,
      params,
    );
    const grossRevenueCents = payRow?.total ?? 0;
    const successfulPaymentsCount = payRow?.count ?? 0;

    // Total refunds
    const refundClauses: string[] = [
      'p.shop_id = ?',
      "r.status = 'processed'",
    ];
    const refundParams: unknown[] = [shopId];
    if (fromDate) {
      refundClauses.push('r.created_at >= ?');
      refundParams.push(fromDate);
    }
    if (toDate) {
      refundClauses.push('r.created_at <= ?');
      refundParams.push(toDate);
    }

    const refRow = db.get<{ total: number | null }>(
      `SELECT SUM(r.amount_cents) AS total
       FROM refunds r
       JOIN payments p ON p.id = r.payment_id
       WHERE ${refundClauses.join(' AND ')}`,
      refundParams,
    );
    const refundsCents = refRow?.total ?? 0;
    const netRevenueCents = grossRevenueCents - refundsCents;
    const averageTicketCents =
      successfulPaymentsCount > 0 ? Math.round(grossRevenueCents / successfulPaymentsCount) : 0;

    // Daily breakdown
    const dailyRows = db.all<{ day: string; daily_total: number }>(
      `SELECT substr(p.created_at, 1, 10) AS day, SUM(p.amount_cents) AS daily_total
       FROM payments p
       ${where}
       GROUP BY day
       ORDER BY day ASC`,
      params,
    );

    const dailyTrend = dailyRows.map((r) => ({
      date: r.day,
      revenueCents: r.daily_total,
    }));

    return {
      grossRevenueCents,
      refundsCents,
      netRevenueCents,
      successfulPaymentsCount,
      averageTicketCents,
      dailyTrend,
    };
  }

  getShopBookingStats(
    shopId: string,
    fromDate?: string,
    toDate?: string,
  ): BookingStats {
    const { db } = this.deps;
    const clauses: string[] = ['shop_id = ?', 'deleted_at IS NULL'];
    const params: unknown[] = [shopId];

    if (fromDate) {
      clauses.push('appointment_date >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      clauses.push('appointment_date <= ?');
      params.push(toDate);
    }

    const where = `WHERE ${clauses.join(' AND ')}`;

    const rows = db.all<{ status: string; count: number }>(
      `SELECT status, COUNT(*) AS count
       FROM appointments
       ${where}
       GROUP BY status`,
      params,
    );

    let completedCount = 0;
    let cancelledCount = 0;
    let noShowCount = 0;
    let confirmedCount = 0;
    let totalAppointments = 0;

    for (const r of rows) {
      totalAppointments += r.count;
      switch (r.status) {
        case 'completed':
          completedCount += r.count;
          break;
        case 'cancelled':
          cancelledCount += r.count;
          break;
        case 'no_show':
          noShowCount += r.count;
          break;
        case 'confirmed':
        case 'in_progress':
          confirmedCount += r.count;
          break;
      }
    }

    const completionRatePercent =
      totalAppointments > 0 ? Math.round((completedCount / totalAppointments) * 1000) / 10 : 0;
    const cancellationRatePercent =
      totalAppointments > 0 ? Math.round((cancelledCount / totalAppointments) * 1000) / 10 : 0;
    const noShowRatePercent =
      totalAppointments > 0 ? Math.round((noShowCount / totalAppointments) * 1000) / 10 : 0;

    return {
      totalAppointments,
      completedCount,
      cancelledCount,
      noShowCount,
      confirmedCount,
      completionRatePercent,
      cancellationRatePercent,
      noShowRatePercent,
    };
  }

  getShopCustomerStats(
    shopId: string,
    fromDate?: string,
    toDate?: string,
  ): CustomerStats {
    const { db } = this.deps;
    const clauses: string[] = ['shop_id = ?', 'deleted_at IS NULL'];
    const params: unknown[] = [shopId];

    if (fromDate) {
      clauses.push('appointment_date >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      clauses.push('appointment_date <= ?');
      params.push(toDate);
    }

    const where = `WHERE ${clauses.join(' AND ')}`;

    const rows = db.all<{ customer_id: string; total_bookings: number }>(
      `SELECT customer_id, COUNT(*) AS total_bookings
       FROM appointments
       ${where}
       GROUP BY customer_id`,
      params,
    );

    const uniqueCustomersCount = rows.length;
    let repeatCustomersCount = 0;
    let newCustomersCount = 0;

    for (const r of rows) {
      if (r.total_bookings > 1) {
        repeatCustomersCount++;
      } else {
        newCustomersCount++;
      }
    }

    return {
      uniqueCustomersCount,
      repeatCustomersCount,
      newCustomersCount,
    };
  }

  getStaffPerformanceStats(
    shopId: string,
    fromDate?: string,
    toDate?: string,
  ): StaffPerformanceItem[] {
    const { db } = this.deps;

    const staffRows = db.all<{
      id: string;
      display_name: string;
      employee_code: string;
      commission_bps: number;
      rating_avg: number;
      rating_count: number;
    }>(
      `SELECT id, display_name, employee_code, commission_bps, rating_avg, rating_count
       FROM staff
       WHERE shop_id = ? AND status = 'active' AND deleted_at IS NULL`,
      [shopId],
    );

    const result: StaffPerformanceItem[] = [];

    for (const st of staffRows) {
      const aptClauses: string[] = [
        'staff_id = ?',
        "status = 'completed'",
        'deleted_at IS NULL',
      ];
      const aptParams: unknown[] = [st.id];

      if (fromDate) {
        aptClauses.push('appointment_date >= ?');
        aptParams.push(fromDate);
      }
      if (toDate) {
        aptClauses.push('appointment_date <= ?');
        aptParams.push(toDate);
      }

      const row = db.get<{ count: number; gross: number | null }>(
        `SELECT COUNT(*) AS count, SUM(total_price_cents) AS gross
         FROM appointments
         WHERE ${aptClauses.join(' AND ')}`,
        aptParams,
      );

      const completedAppointmentsCount = row?.count ?? 0;
      const grossRevenueCents = row?.gross ?? 0;
      const commissionEarnedCents = Math.round(
        (grossRevenueCents * st.commission_bps) / 10000,
      );

      result.push({
        staffId: st.id,
        displayName: st.display_name,
        employeeCode: st.employee_code,
        commissionBps: st.commission_bps,
        completedAppointmentsCount,
        grossRevenueCents,
        commissionEarnedCents,
        ratingAvg: st.rating_avg,
        ratingCount: st.rating_count,
      });
    }

    // Sort by gross revenue DESC
    result.sort((a, b) => b.grossRevenueCents - a.grossRevenueCents);
    return result;
  }

  getPopularServices(
    shopId: string,
    fromDate?: string,
    toDate?: string,
    limit = 10,
  ): PopularServiceItem[] {
    const { db } = this.deps;
    const clauses: string[] = [
      'a.shop_id = ?',
      "a.status = 'completed'",
      'a.deleted_at IS NULL',
    ];
    const params: unknown[] = [shopId];

    if (fromDate) {
      clauses.push('a.appointment_date >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      clauses.push('a.appointment_date <= ?');
      params.push(toDate);
    }

    const where = `WHERE ${clauses.join(' AND ')}`;

    const rows = db.all<{
      service_id: string;
      service_name: string;
      count: number;
      gross: number;
    }>(
      `SELECT asrv.service_id, asrv.service_name, COUNT(*) AS count, SUM(asrv.price_cents) AS gross
       FROM appointment_services asrv
       JOIN appointments a ON a.id = asrv.appointment_id
       ${where}
       GROUP BY asrv.service_id, asrv.service_name
       ORDER BY count DESC, gross DESC
       LIMIT ?`,
      [...params, limit],
    );

    return rows.map((r) => ({
      serviceId: r.service_id,
      serviceName: r.service_name,
      bookingsCount: r.count,
      grossRevenueCents: r.gross,
    }));
  }

  getStaffEarnings(
    staffId: string,
    fromDate?: string,
    toDate?: string,
  ): StaffEarningsOverview {
    const { db } = this.deps;

    const staff = db.get<{
      id: string;
      display_name: string;
      commission_bps: number;
    }>(
      `SELECT id, display_name, commission_bps
       FROM staff
       WHERE id = ? AND deleted_at IS NULL`,
      [staffId],
    );

    if (!staff) {
      throw new NotFoundError('Staff', staffId);
    }

    const aptClauses: string[] = [
      'staff_id = ?',
      "status = 'completed'",
      'deleted_at IS NULL',
    ];
    const aptParams: unknown[] = [staffId];

    if (fromDate) {
      aptClauses.push('appointment_date >= ?');
      aptParams.push(fromDate);
    }
    if (toDate) {
      aptClauses.push('appointment_date <= ?');
      aptParams.push(toDate);
    }

    const where = `WHERE ${aptClauses.join(' AND ')}`;

    const row = db.get<{ count: number; gross: number | null }>(
      `SELECT COUNT(*) AS count, SUM(total_price_cents) AS gross
       FROM appointments
       ${where}`,
      aptParams,
    );

    const completedAppointmentsCount = row?.count ?? 0;
    const grossRevenueCents = row?.gross ?? 0;
    const commissionEarnedCents = Math.round(
      (grossRevenueCents * staff.commission_bps) / 10000,
    );

    // List recent completed bookings for staff
    const recentRows = db.all<{
      id: string;
      appointment_date: string;
      total_price_cents: number;
      service_name: string | null;
    }>(
      `SELECT a.id, a.appointment_date, a.total_price_cents,
              (SELECT service_name FROM appointment_services WHERE appointment_id = a.id LIMIT 1) AS service_name
       FROM appointments a
       ${where}
       ORDER BY a.appointment_date DESC, a.starts_at DESC
       LIMIT 25`,
      aptParams,
    );

    const recentBookings = recentRows.map((r) => ({
      appointmentId: r.id,
      appointmentDate: r.appointment_date,
      serviceName: r.service_name ?? 'Service',
      priceCents: r.total_price_cents,
      commissionCents: Math.round((r.total_price_cents * staff.commission_bps) / 10000),
    }));

    return {
      staffId: staff.id,
      displayName: staff.display_name,
      commissionBps: staff.commission_bps,
      commissionRatePercent: staff.commission_bps / 100,
      completedAppointmentsCount,
      grossRevenueCents,
      commissionEarnedCents,
      recentBookings,
    };
  }
}
