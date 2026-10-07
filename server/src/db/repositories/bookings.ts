import { newId } from '../../core/ids';
import type { Db } from '../sqlite';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface AppointmentRecord {
  id: string;
  shopId: string;
  branchId: string;
  customerId: string;
  staffId: string;
  status: AppointmentStatus;
  appointmentDate: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  bufferMinutes: number;
  totalPriceCents: number;
  currency: string;
  notes: string | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface AppointmentRow {
  id: string;
  shop_id: string;
  branch_id: string;
  customer_id: string;
  staff_id: string;
  status: AppointmentStatus;
  appointment_date: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  buffer_minutes: number;
  total_price_cents: number;
  currency: string;
  notes: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AppointmentServiceItemRecord {
  id: string;
  appointmentId: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  sortOrder: number;
  createdAt: string;
}

interface AppointmentServiceItemRow {
  id: string;
  appointment_id: string;
  service_id: string;
  service_name: string;
  duration_minutes: number;
  price_cents: number;
  sort_order: number;
  created_at: string;
}

export interface AppointmentStatusHistoryRecord {
  id: string;
  appointmentId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  reason: string | null;
  createdAt: string;
}

interface AppointmentStatusHistoryRow {
  id: string;
  appointment_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface AppointmentWithDetailsRecord extends AppointmentRecord {
  services: AppointmentServiceItemRecord[];
}

function mapAppointmentRow(row: AppointmentRow): AppointmentRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    branchId: row.branch_id,
    customerId: row.customer_id,
    staffId: row.staff_id,
    status: row.status,
    appointmentDate: row.appointment_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    durationMinutes: row.duration_minutes,
    bufferMinutes: row.buffer_minutes,
    totalPriceCents: row.total_price_cents,
    currency: row.currency,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapServiceItemRow(row: AppointmentServiceItemRow): AppointmentServiceItemRecord {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapStatusHistoryRow(row: AppointmentStatusHistoryRow): AppointmentStatusHistoryRecord {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedBy: row.changed_by,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

const AppointmentSelectColumns = `
  id, shop_id, branch_id, customer_id, staff_id, status, appointment_date,
  starts_at, ends_at, duration_minutes, buffer_minutes, total_price_cents,
  currency, notes, cancellation_reason, cancelled_by, cancelled_at,
  created_at, updated_at, deleted_at`;

const ServiceItemSelectColumns = `
  id, appointment_id, service_id, service_name, duration_minutes,
  price_cents, sort_order, created_at`;

const StatusHistorySelectColumns = `
  id, appointment_id, from_status, to_status, changed_by, reason, created_at`;

export interface CreateAppointmentInput {
  id?: string;
  shopId: string;
  branchId: string;
  customerId: string;
  staffId: string;
  status?: AppointmentStatus;
  appointmentDate: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  bufferMinutes?: number;
  totalPriceCents: number;
  currency?: string;
  notes?: string | null;
}

export interface CreateAppointmentServiceInput {
  id?: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  sortOrder?: number;
}

export interface ListAppointmentsFilter {
  shopId?: string;
  branchId?: string;
  customerId?: string;
  staffId?: string;
  date?: string;
  status?: AppointmentStatus | AppointmentStatus[];
  fromDate?: string;
  toDate?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export class BookingsRepository {
  constructor(private readonly db: Db) {}

  findById(id: string, options: { includeDeleted?: boolean } = {}): AppointmentRecord | null {
    const row = this.db.get<AppointmentRow>(
      `SELECT ${AppointmentSelectColumns} FROM appointments WHERE id = ?${options.includeDeleted ? '' : ' AND deleted_at IS NULL'}`,
      [id],
    );
    return row ? mapAppointmentRow(row) : null;
  }

  requireById(id: string): AppointmentRecord {
    const apt = this.findById(id);
    if (!apt) throw new Error(`appointment '${id}' not found`);
    return apt;
  }

  findWithDetails(id: string, options: { includeDeleted?: boolean } = {}): AppointmentWithDetailsRecord | null {
    const apt = this.findById(id, options);
    if (!apt) return null;

    const services = this.db
      .all<AppointmentServiceItemRow>(
        `SELECT ${ServiceItemSelectColumns} FROM appointment_services WHERE appointment_id = ? ORDER BY sort_order ASC`,
        [id],
      )
      .map(mapServiceItemRow);

    return { ...apt, services };
  }

  requireWithDetails(id: string): AppointmentWithDetailsRecord {
    const apt = this.findWithDetails(id);
    if (!apt) throw new Error(`appointment '${id}' not found`);
    return apt;
  }

  /**
   * Conflict check: finds any non-cancelled appointment for this staff member
   * whose time window overlaps with the requested interval [startsAt, endsAt).
   */
  findConflicts(
    staffId: string,
    startsAt: string,
    endsAt: string,
    excludeAppointmentId?: string,
  ): AppointmentRecord[] {
    const clauses = [
      'staff_id = ?',
      'deleted_at IS NULL',
      "status NOT IN ('cancelled', 'no_show')",
      'starts_at < ?',
      'ends_at > ?',
    ];
    const params: unknown[] = [staffId, endsAt, startsAt];

    if (excludeAppointmentId) {
      clauses.push('id <> ?');
      params.push(excludeAppointmentId);
    }

    return this.db
      .all<AppointmentRow>(
        `SELECT ${AppointmentSelectColumns} FROM appointments WHERE ${clauses.join(' AND ')} ORDER BY starts_at ASC`,
        params,
      )
      .map(mapAppointmentRow);
  }

  list(filter: ListAppointmentsFilter = {}): AppointmentRecord[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (!filter.includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }
    if (filter.shopId) {
      clauses.push('shop_id = ?');
      params.push(filter.shopId);
    }
    if (filter.branchId) {
      clauses.push('branch_id = ?');
      params.push(filter.branchId);
    }
    if (filter.customerId) {
      clauses.push('customer_id = ?');
      params.push(filter.customerId);
    }
    if (filter.staffId) {
      clauses.push('staff_id = ?');
      params.push(filter.staffId);
    }
    if (filter.date) {
      clauses.push('appointment_date = ?');
      params.push(filter.date);
    }
    if (filter.fromDate) {
      clauses.push('appointment_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      clauses.push('appointment_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.status) {
      if (Array.isArray(filter.status)) {
        clauses.push(`status IN (${filter.status.map(() => '?').join(', ')})`);
        params.push(...filter.status);
      } else {
        clauses.push('status = ?');
        params.push(filter.status);
      }
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = filter.limit !== undefined ? `LIMIT ${filter.limit} OFFSET ${filter.offset ?? 0}` : '';

    return this.db
      .all<AppointmentRow>(
        `SELECT ${AppointmentSelectColumns} FROM appointments ${where} ORDER BY starts_at ASC, id ASC ${limit}`,
        params,
      )
      .map(mapAppointmentRow);
  }

  count(filter: ListAppointmentsFilter = {}): number {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (!filter.includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }
    if (filter.shopId) {
      clauses.push('shop_id = ?');
      params.push(filter.shopId);
    }
    if (filter.branchId) {
      clauses.push('branch_id = ?');
      params.push(filter.branchId);
    }
    if (filter.customerId) {
      clauses.push('customer_id = ?');
      params.push(filter.customerId);
    }
    if (filter.staffId) {
      clauses.push('staff_id = ?');
      params.push(filter.staffId);
    }
    if (filter.date) {
      clauses.push('appointment_date = ?');
      params.push(filter.date);
    }
    if (filter.fromDate) {
      clauses.push('appointment_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      clauses.push('appointment_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.status) {
      if (Array.isArray(filter.status)) {
        clauses.push(`status IN (${filter.status.map(() => '?').join(', ')})`);
        params.push(...filter.status);
      } else {
        clauses.push('status = ?');
        params.push(filter.status);
      }
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const row = this.db.get<{ count: number }>(`SELECT COUNT(*) AS count FROM appointments ${where}`, params);
    return row?.count ?? 0;
  }

  create(
    input: CreateAppointmentInput,
    services: CreateAppointmentServiceInput[],
  ): AppointmentWithDetailsRecord {
    const id = input.id ?? newId('bkd');
    const now = new Date().toISOString();
    const status = input.status ?? 'confirmed';

    this.db.transaction(() => {
      this.db.run(
        `INSERT INTO appointments (
           id, shop_id, branch_id, customer_id, staff_id, status, appointment_date,
           starts_at, ends_at, duration_minutes, buffer_minutes, total_price_cents,
           currency, notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.shopId,
          input.branchId,
          input.customerId,
          input.staffId,
          status,
          input.appointmentDate,
          input.startsAt,
          input.endsAt,
          input.durationMinutes,
          input.bufferMinutes ?? 0,
          input.totalPriceCents,
          input.currency ?? 'USD',
          input.notes ?? null,
          now,
          now,
        ],
      );

      for (let i = 0; i < services.length; i++) {
        const item = services[i]!;
        const itemId = item.id ?? newId('srv');
        this.db.run(
          `INSERT INTO appointment_services (
             id, appointment_id, service_id, service_name, duration_minutes, price_cents, sort_order, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            id,
            item.serviceId,
            item.serviceName,
            item.durationMinutes,
            item.priceCents,
            item.sortOrder ?? i,
            now,
          ],
        );
      }

      // Initial status audit log
      this.db.run(
        `INSERT INTO appointment_status_history (id, appointment_id, from_status, to_status, changed_by, reason, created_at)
         VALUES (?, ?, NULL, ?, ?, 'Appointment created', ?)`,
        [newId('req'), id, status, input.customerId, now],
      );
    });

    return this.requireWithDetails(id);
  }

  updateStatus(
    id: string,
    newStatus: AppointmentStatus,
    changedBy?: string | null,
    reason?: string | null,
  ): AppointmentRecord {
    const current = this.requireById(id);
    if (current.status === newStatus) return current;

    const now = new Date().toISOString();

    this.db.transaction(() => {
      this.db.run(
        `UPDATE appointments SET status = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
        [newStatus, now, id],
      );

      this.db.run(
        `INSERT INTO appointment_status_history (id, appointment_id, from_status, to_status, changed_by, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId('req'), id, current.status, newStatus, changedBy ?? null, reason ?? null, now],
      );
    });

    return this.requireById(id);
  }

  cancel(id: string, reason: string, cancelledBy?: string | null): AppointmentRecord {
    const current = this.requireById(id);
    const now = new Date().toISOString();

    this.db.transaction(() => {
      this.db.run(
        `UPDATE appointments
         SET status = 'cancelled', cancellation_reason = ?, cancelled_by = ?, cancelled_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [reason, cancelledBy ?? null, now, now, id],
      );

      this.db.run(
        `INSERT INTO appointment_status_history (id, appointment_id, from_status, to_status, changed_by, reason, created_at)
         VALUES (?, ?, ?, 'cancelled', ?, ?, ?)`,
        [newId('req'), id, current.status, cancelledBy ?? null, reason, now],
      );
    });

    return this.requireById(id);
  }

  reschedule(
    id: string,
    newDate: string,
    newStartsAt: string,
    newEndsAt: string,
    changedBy?: string | null,
  ): AppointmentRecord {
    const now = new Date().toISOString();

    this.db.transaction(() => {
      this.db.run(
        `UPDATE appointments
         SET appointment_date = ?, starts_at = ?, ends_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [newDate, newStartsAt, newEndsAt, now, id],
      );

      this.db.run(
        `INSERT INTO appointment_status_history (id, appointment_id, from_status, to_status, changed_by, reason, created_at)
         VALUES (?, ?, 'rescheduled', 'confirmed', ?, 'Rescheduled appointment time', ?)`,
        [newId('req'), id, changedBy ?? null, now],
      );
    });

    return this.requireById(id);
  }

  getStatusHistory(appointmentId: string): AppointmentStatusHistoryRecord[] {
    return this.db
      .all<AppointmentStatusHistoryRow>(
        `SELECT ${StatusHistorySelectColumns} FROM appointment_status_history WHERE appointment_id = ? ORDER BY created_at ASC`,
        [appointmentId],
      )
      .map(mapStatusHistoryRow);
  }

  softDelete(id: string): void {
    const now = new Date().toISOString();
    this.db.run(`UPDATE appointments SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
  }
}
