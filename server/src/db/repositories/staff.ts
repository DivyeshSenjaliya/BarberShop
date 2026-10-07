import { newId } from '../../core/ids';
import type { Db } from '../sqlite';

export type StaffStatus = 'invited' | 'active' | 'inactive' | 'terminated';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'chair_rental';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'on_leave' | 'half_day';

export interface StaffRecord {
  id: string;
  userId: string | null;
  shopId: string;
  employeeCode: string;
  displayName: string;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  commissionBps: number;
  status: StaffStatus;
  employment: EmploymentType;
  canAcceptBookings: boolean;
  ratingAvg: number;
  ratingCount: number;
  hiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface StaffRow {
  id: string;
  user_id: string | null;
  shop_id: string;
  employee_code: string;
  display_name: string;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  commission_bps: number;
  status: StaffStatus;
  employment: EmploymentType;
  can_accept_bookings: number;
  rating_avg: number;
  rating_count: number;
  hired_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface StaffBranchRecord {
  staffId: string;
  branchId: string;
  isPrimary: boolean;
  createdAt: string;
}

interface StaffBranchRow {
  staff_id: string;
  branch_id: string;
  is_primary: number;
  created_at: string;
}

export interface StaffScheduleRecord {
  id: string;
  staffId: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  validFrom: string;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StaffScheduleRow {
  id: string;
  staff_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffBreakRecord {
  id: string;
  staffId: string;
  weekday: number;
  name: string | null;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

interface StaffBreakRow {
  id: string;
  staff_id: string;
  weekday: number;
  name: string | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

export interface StaffLeaveRecord {
  id: string;
  staffId: string;
  startsOn: string;
  endsOn: string;
  halfDay: boolean;
  reason: string | null;
  status: LeaveStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StaffLeaveRow {
  id: string;
  staff_id: string;
  starts_on: string;
  ends_on: string;
  half_day: number;
  reason: string | null;
  status: LeaveStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffOverrideRecord {
  id: string;
  staffId: string;
  overrideDate: string;
  available: boolean;
  startsAt: string | null;
  endsAt: string | null;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StaffOverrideRow {
  id: string;
  staff_id: string;
  override_date: string;
  available: number;
  starts_at: string | null;
  ends_at: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffAttendanceRecord {
  id: string;
  staffId: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  status: AttendanceStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StaffAttendanceRow {
  id: string;
  staff_id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: AttendanceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapStaffRow(row: StaffRow): StaffRecord {
  return {
    id: row.id,
    userId: row.user_id,
    shopId: row.shop_id,
    employeeCode: row.employee_code,
    displayName: row.display_name,
    title: row.title,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    email: row.email,
    phone: row.phone,
    commissionBps: row.commission_bps,
    status: row.status,
    employment: row.employment,
    canAcceptBookings: row.can_accept_bookings === 1,
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    hiredAt: row.hired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapStaffScheduleRow(row: StaffScheduleRow): StaffScheduleRecord {
  return {
    id: row.id,
    staffId: row.staff_id,
    weekday: row.weekday,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStaffBreakRow(row: StaffBreakRow): StaffBreakRecord {
  return {
    id: row.id,
    staffId: row.staff_id,
    weekday: row.weekday,
    name: row.name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  };
}

function mapStaffLeaveRow(row: StaffLeaveRow): StaffLeaveRecord {
  return {
    id: row.id,
    staffId: row.staff_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    halfDay: row.half_day === 1,
    reason: row.reason,
    status: row.status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStaffOverrideRow(row: StaffOverrideRow): StaffOverrideRecord {
  return {
    id: row.id,
    staffId: row.staff_id,
    overrideDate: row.override_date,
    available: row.available === 1,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStaffAttendanceRow(row: StaffAttendanceRow): StaffAttendanceRecord {
  return {
    id: row.id,
    staffId: row.staff_id,
    workDate: row.work_date,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const StaffSelectColumns = `
  id, user_id, shop_id, employee_code, display_name, title, bio, avatar_url,
  email, phone, commission_bps, status, employment, can_accept_bookings,
  rating_avg, rating_count, hired_at, created_at, updated_at, deleted_at`;

const ScheduleSelectColumns = `
  id, staff_id, weekday, starts_at, ends_at, valid_from, valid_until,
  created_at, updated_at`;

const BreakSelectColumns = `
  id, staff_id, weekday, name, starts_at, ends_at, created_at`;

const LeaveSelectColumns = `
  id, staff_id, starts_on, ends_on, half_day, reason, status, decided_by,
  decided_at, created_at, updated_at`;

const OverrideSelectColumns = `
  id, staff_id, override_date, available, starts_at, ends_at, reason,
  created_by, created_at, updated_at`;

const AttendanceSelectColumns = `
  id, staff_id, work_date, clock_in, clock_out, status, notes,
  created_at, updated_at`;

export interface CreateStaffInput {
  id?: string;
  userId?: string | null;
  shopId: string;
  employeeCode: string;
  displayName: string;
  title?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  commissionBps?: number;
  status?: StaffStatus;
  employment?: EmploymentType;
  canAcceptBookings?: boolean;
  hiredAt?: string | null;
}

export interface UpdateStaffInput {
  userId?: string | null;
  employeeCode?: string;
  displayName?: string;
  title?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  commissionBps?: number;
  status?: StaffStatus;
  employment?: EmploymentType;
  canAcceptBookings?: boolean;
  hiredAt?: string | null;
}

export interface SetStaffScheduleInput {
  id?: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  validFrom?: string;
  validUntil?: string | null;
}

export interface SetStaffBreakInput {
  id?: string;
  weekday: number;
  name?: string | null;
  startsAt: string;
  endsAt: string;
}

export interface RequestLeaveInput {
  id?: string;
  staffId: string;
  startsOn: string;
  endsOn: string;
  halfDay?: boolean;
  reason?: string | null;
}

export interface SetOverrideInput {
  id?: string;
  staffId: string;
  overrideDate: string;
  available: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  reason?: string | null;
  createdBy?: string | null;
}

export interface RecordAttendanceInput {
  id?: string;
  staffId: string;
  workDate: string;
  clockIn?: string | null;
  clockOut?: string | null;
  status?: AttendanceStatus;
  notes?: string | null;
}

export class StaffRepository {
  constructor(private readonly db: Db) {}

  // ---------------------------------------------------------------------------
  // Staff Profiles
  // ---------------------------------------------------------------------------

  findStaffById(id: string, options: { includeDeleted?: boolean } = {}): StaffRecord | null {
    const row = this.db.get<StaffRow>(
      `SELECT ${StaffSelectColumns} FROM staff WHERE id = ?${options.includeDeleted ? '' : ' AND deleted_at IS NULL'}`,
      [id],
    );
    return row ? mapStaffRow(row) : null;
  }

  requireStaffById(id: string): StaffRecord {
    const staff = this.findStaffById(id);
    if (!staff) throw new Error(`staff '${id}' not found`);
    return staff;
  }

  findStaffByCode(shopId: string, employeeCode: string): StaffRecord | null {
    const row = this.db.get<StaffRow>(
      `SELECT ${StaffSelectColumns} FROM staff WHERE shop_id = ? AND employee_code = ? AND deleted_at IS NULL`,
      [shopId, employeeCode.trim()],
    );
    return row ? mapStaffRow(row) : null;
  }

  listStaff(options: {
    shopId: string;
    branchId?: string;
    serviceId?: string;
    status?: StaffStatus;
    canAcceptBookings?: boolean;
    includeDeleted?: boolean;
  }): StaffRecord[] {
    const clauses: string[] = ['s.shop_id = ?'];
    const params: unknown[] = [options.shopId];

    if (!options.includeDeleted) {
      clauses.push('s.deleted_at IS NULL');
    }
    if (options.status) {
      clauses.push('s.status = ?');
      params.push(options.status);
    }
    if (options.canAcceptBookings !== undefined) {
      clauses.push('s.can_accept_bookings = ?');
      params.push(options.canAcceptBookings ? 1 : 0);
    }
    if (options.branchId) {
      clauses.push('EXISTS (SELECT 1 FROM staff_branches sb WHERE sb.staff_id = s.id AND sb.branch_id = ?)');
      params.push(options.branchId);
    }
    if (options.serviceId) {
      clauses.push('EXISTS (SELECT 1 FROM staff_services ss WHERE ss.staff_id = s.id AND ss.service_id = ?)');
      params.push(options.serviceId);
    }

    const where = `WHERE ${clauses.join(' AND ')}`;
    return this.db
      .all<StaffRow>(
        `SELECT s.id, s.user_id, s.shop_id, s.employee_code, s.display_name, s.title, s.bio, s.avatar_url,
                s.email, s.phone, s.commission_bps, s.status, s.employment, s.can_accept_bookings,
                s.rating_avg, s.rating_count, s.hired_at, s.created_at, s.updated_at, s.deleted_at
         FROM staff s ${where} ORDER BY s.display_name ASC`,
        params,
      )
      .map(mapStaffRow);
  }

  createStaff(input: CreateStaffInput): StaffRecord {
    const id = input.id ?? newId('staff');
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO staff (
         id, user_id, shop_id, employee_code, display_name, title, bio,
         avatar_url, email, phone, commission_bps, status, employment,
         can_accept_bookings, hired_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.userId ?? null,
        input.shopId,
        input.employeeCode.trim(),
        input.displayName.trim(),
        input.title?.trim() ?? null,
        input.bio?.trim() ?? null,
        input.avatarUrl ?? null,
        input.email?.trim().toLowerCase() ?? null,
        input.phone?.trim() ?? null,
        input.commissionBps ?? 0,
        input.status ?? 'active',
        input.employment ?? 'full_time',
        input.canAcceptBookings !== false ? 1 : 0,
        input.hiredAt ?? null,
        now,
        now,
      ],
    );
    return this.requireStaffById(id);
  }

  updateStaff(id: string, patch: UpdateStaffInput): StaffRecord {
    const fields: string[] = [];
    const values: unknown[] = [];

    const set = (col: string, val: unknown): void => {
      fields.push(`${col} = ?`);
      values.push(val);
    };

    if (patch.userId !== undefined) set('user_id', patch.userId);
    if (patch.employeeCode !== undefined) set('employee_code', patch.employeeCode.trim());
    if (patch.displayName !== undefined) set('display_name', patch.displayName.trim());
    if (patch.title !== undefined) set('title', patch.title?.trim() ?? null);
    if (patch.bio !== undefined) set('bio', patch.bio?.trim() ?? null);
    if (patch.avatarUrl !== undefined) set('avatar_url', patch.avatarUrl);
    if (patch.email !== undefined) set('email', patch.email?.trim().toLowerCase() ?? null);
    if (patch.phone !== undefined) set('phone', patch.phone?.trim() ?? null);
    if (patch.commissionBps !== undefined) set('commission_bps', patch.commissionBps);
    if (patch.status !== undefined) set('status', patch.status);
    if (patch.employment !== undefined) set('employment', patch.employment);
    if (patch.canAcceptBookings !== undefined) set('can_accept_bookings', patch.canAcceptBookings ? 1 : 0);
    if (patch.hiredAt !== undefined) set('hired_at', patch.hiredAt);

    if (fields.length > 0) {
      set('updated_at', new Date().toISOString());
      values.push(id);
      this.db.run(`UPDATE staff SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values);
    }

    return this.requireStaffById(id);
  }

  updateRating(id: string, ratingAvg: number, ratingCount: number): StaffRecord {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE staff SET rating_avg = ?, rating_count = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [ratingAvg, ratingCount, now, id],
    );
    return this.requireStaffById(id);
  }

  softDeleteStaff(id: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE staff SET deleted_at = ?, status = 'inactive', updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
  }

  // ---------------------------------------------------------------------------
  // Skills / Services
  // ---------------------------------------------------------------------------

  getStaffServiceIds(staffId: string): string[] {
    const rows = this.db.all<{ service_id: string }>(
      'SELECT service_id FROM staff_services WHERE staff_id = ? ORDER BY created_at ASC',
      [staffId],
    );
    return rows.map((r) => r.service_id);
  }

  setStaffServices(staffId: string, serviceIds: string[]): void {
    this.db.transaction(() => {
      this.db.run('DELETE FROM staff_services WHERE staff_id = ?', [staffId]);
      const now = new Date().toISOString();
      for (const serviceId of serviceIds) {
        this.db.run(
          'INSERT INTO staff_services (staff_id, service_id, created_at) VALUES (?, ?, ?)',
          [staffId, serviceId, now],
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Staff Branches
  // ---------------------------------------------------------------------------

  getStaffBranches(staffId: string): StaffBranchRecord[] {
    const rows = this.db.all<StaffBranchRow>(
      'SELECT staff_id, branch_id, is_primary, created_at FROM staff_branches WHERE staff_id = ? ORDER BY is_primary DESC',
      [staffId],
    );
    return rows.map((r) => ({
      staffId: r.staff_id,
      branchId: r.branch_id,
      isPrimary: r.is_primary === 1,
      createdAt: r.created_at,
    }));
  }

  setStaffBranches(staffId: string, branches: Array<{ branchId: string; isPrimary?: boolean }>): void {
    this.db.transaction(() => {
      this.db.run('DELETE FROM staff_branches WHERE staff_id = ?', [staffId]);
      const now = new Date().toISOString();
      for (const b of branches) {
        this.db.run(
          'INSERT INTO staff_branches (staff_id, branch_id, is_primary, created_at) VALUES (?, ?, ?, ?)',
          [staffId, b.branchId, b.isPrimary ? 1 : 0, now],
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Schedules & Breaks
  // ---------------------------------------------------------------------------

  getStaffSchedules(staffId: string): StaffScheduleRecord[] {
    return this.db
      .all<StaffScheduleRow>(
        `SELECT ${ScheduleSelectColumns} FROM staff_schedules WHERE staff_id = ? ORDER BY weekday ASC, valid_from ASC`,
        [staffId],
      )
      .map(mapStaffScheduleRow);
  }

  setStaffSchedules(staffId: string, schedules: SetStaffScheduleInput[]): StaffScheduleRecord[] {
    this.db.transaction(() => {
      this.db.run('DELETE FROM staff_schedules WHERE staff_id = ?', [staffId]);
      const now = new Date().toISOString();
      for (const s of schedules) {
        const id = s.id ?? newId('sched');
        this.db.run(
          `INSERT INTO staff_schedules (
             id, staff_id, weekday, starts_at, ends_at, valid_from, valid_until, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            staffId,
            s.weekday,
            s.startsAt,
            s.endsAt,
            s.validFrom ?? '1970-01-01',
            s.validUntil ?? null,
            now,
            now,
          ],
        );
      }
    });
    return this.getStaffSchedules(staffId);
  }

  getStaffBreaks(staffId: string): StaffBreakRecord[] {
    return this.db
      .all<StaffBreakRow>(
        `SELECT ${BreakSelectColumns} FROM staff_breaks WHERE staff_id = ? ORDER BY weekday ASC, starts_at ASC`,
        [staffId],
      )
      .map(mapStaffBreakRow);
  }

  setStaffBreaks(staffId: string, breaks: SetStaffBreakInput[]): StaffBreakRecord[] {
    this.db.transaction(() => {
      this.db.run('DELETE FROM staff_breaks WHERE staff_id = ?', [staffId]);
      const now = new Date().toISOString();
      for (const b of breaks) {
        const id = b.id ?? newId('sched');
        this.db.run(
          `INSERT INTO staff_breaks (
             id, staff_id, weekday, name, starts_at, ends_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, staffId, b.weekday, b.name ?? null, b.startsAt, b.endsAt, now],
        );
      }
    });
    return this.getStaffBreaks(staffId);
  }

  // ---------------------------------------------------------------------------
  // Leaves
  // ---------------------------------------------------------------------------

  requestLeave(input: RequestLeaveInput): StaffLeaveRecord {
    const id = input.id ?? newId('sched');
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO staff_leaves (
         id, staff_id, starts_on, ends_on, half_day, reason, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, input.staffId, input.startsOn, input.endsOn, input.halfDay ? 1 : 0, input.reason ?? null, now, now],
    );
    const row = this.db.get<StaffLeaveRow>(`SELECT ${LeaveSelectColumns} FROM staff_leaves WHERE id = ?`, [id]);
    if (!row) throw new Error(`leave ${id} disappeared`);
    return mapStaffLeaveRow(row);
  }

  decideLeave(id: string, status: 'approved' | 'rejected' | 'cancelled', decidedBy: string): StaffLeaveRecord {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE staff_leaves SET status = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?`,
      [status, decidedBy, now, now, id],
    );
    const row = this.db.get<StaffLeaveRow>(`SELECT ${LeaveSelectColumns} FROM staff_leaves WHERE id = ?`, [id]);
    if (!row) throw new Error(`leave ${id} not found`);
    return mapStaffLeaveRow(row);
  }

  listLeaves(staffId: string, options: { status?: LeaveStatus } = {}): StaffLeaveRecord[] {
    const clauses = ['staff_id = ?'];
    const params: unknown[] = [staffId];
    if (options.status) {
      clauses.push('status = ?');
      params.push(options.status);
    }
    return this.db
      .all<StaffLeaveRow>(
        `SELECT ${LeaveSelectColumns} FROM staff_leaves WHERE ${clauses.join(' AND ')} ORDER BY starts_on DESC`,
        params,
      )
      .map(mapStaffLeaveRow);
  }

  // ---------------------------------------------------------------------------
  // Availability Overrides
  // ---------------------------------------------------------------------------

  setAvailabilityOverride(input: SetOverrideInput): StaffOverrideRecord {
    const id = input.id ?? newId('sched');
    const now = new Date().toISOString();
    const available = input.available ? 1 : 0;
    this.db.run(
      `INSERT INTO staff_availability_overrides (
         id, staff_id, override_date, available, starts_at, ends_at, reason, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (staff_id, override_date) DO UPDATE SET
         available = excluded.available,
         starts_at = excluded.starts_at,
         ends_at = excluded.ends_at,
         reason = excluded.reason,
         created_by = excluded.created_by,
         updated_at = excluded.updated_at`,
      [
        id,
        input.staffId,
        input.overrideDate,
        available,
        available ? (input.startsAt ?? null) : null,
        available ? (input.endsAt ?? null) : null,
        input.reason ?? null,
        input.createdBy ?? null,
        now,
        now,
      ],
    );

    const row = this.db.get<StaffOverrideRow>(
      `SELECT ${OverrideSelectColumns} FROM staff_availability_overrides WHERE staff_id = ? AND override_date = ?`,
      [input.staffId, input.overrideDate],
    );
    if (!row) throw new Error(`override disappeared`);
    return mapStaffOverrideRow(row);
  }

  getOverrideForDate(staffId: string, date: string): StaffOverrideRecord | null {
    const row = this.db.get<StaffOverrideRow>(
      `SELECT ${OverrideSelectColumns} FROM staff_availability_overrides WHERE staff_id = ? AND override_date = ?`,
      [staffId, date],
    );
    return row ? mapStaffOverrideRow(row) : null;
  }

  // ---------------------------------------------------------------------------
  // Attendance
  // ---------------------------------------------------------------------------

  recordAttendance(input: RecordAttendanceInput): StaffAttendanceRecord {
    const id = input.id ?? newId('sched');
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO staff_attendance (
         id, staff_id, work_date, clock_in, clock_out, status, notes, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (staff_id, work_date) DO UPDATE SET
         clock_in = COALESCE(excluded.clock_in, staff_attendance.clock_in),
         clock_out = COALESCE(excluded.clock_out, staff_attendance.clock_out),
         status = COALESCE(excluded.status, staff_attendance.status),
         notes = COALESCE(excluded.notes, staff_attendance.notes),
         updated_at = excluded.updated_at`,
      [
        id,
        input.staffId,
        input.workDate,
        input.clockIn ?? null,
        input.clockOut ?? null,
        input.status ?? 'present',
        input.notes ?? null,
        now,
        now,
      ],
    );

    const row = this.db.get<StaffAttendanceRow>(
      `SELECT ${AttendanceSelectColumns} FROM staff_attendance WHERE staff_id = ? AND work_date = ?`,
      [input.staffId, input.workDate],
    );
    if (!row) throw new Error(`attendance record disappeared`);
    return mapStaffAttendanceRow(row);
  }

  getAttendance(staffId: string, workDate: string): StaffAttendanceRecord | null {
    const row = this.db.get<StaffAttendanceRow>(
      `SELECT ${AttendanceSelectColumns} FROM staff_attendance WHERE staff_id = ? AND work_date = ?`,
      [staffId, workDate],
    );
    return row ? mapStaffAttendanceRow(row) : null;
  }
}
