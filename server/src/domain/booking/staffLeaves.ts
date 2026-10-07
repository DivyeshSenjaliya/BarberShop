import type { Db } from '../../db/sqlite';
import type { BookingsRepository } from '../../db/repositories/bookings';
import { newId } from '../../core/ids';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors';

/**
 * Staff Leave & Vacation Conflict Engine.
 *
 * Business rules enforced here:
 * 1. A leave request cannot overlap an existing approved leave for the same staff.
 * 2. Approving a leave request is blocked if the staff member has confirmed or
 *    pending appointments during the requested period — caller must reschedule
 *    or cancel those bookings first.
 * 3. Leave dates must be non-zero and in a sensible order.
 * 4. Only PENDING requests can be approved / rejected.
 * 5. Staff can only cancel their own PENDING or APPROVED leaves.
 */

export type LeaveType = 'vacation' | 'sick' | 'personal' | 'unpaid' | 'public_holiday';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface StaffLeave {
  id: string;
  staffId: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: LeaveStatus;
  reason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LeaveRow {
  id: string;
  staff_id: string;
  leave_type: string;
  starts_on: string;
  ends_on: string;
  status: string;
  reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: LeaveRow): StaffLeave {
  return {
    id: row.id,
    staffId: row.staff_id,
    leaveType: (row.leave_type ?? 'vacation') as LeaveType,
    startDate: row.starts_on,
    endDate: row.ends_on,
    status: row.status as LeaveStatus,
    reason: row.reason,
    reviewedBy: row.decided_by,
    reviewedAt: row.decided_at,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface RequestLeaveParams {
  staffId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string | null;
}

export interface ApproveLeaveParams {
  leaveId: string;
  reviewedByUserId: string;
}

export interface RejectLeaveParams {
  leaveId: string;
  reviewedByUserId: string;
  rejectReason: string;
}

export class StaffLeavesService {
  constructor(
    private readonly db: Db,
    private readonly bookingsRepo: BookingsRepository,
  ) {}

  requestLeave(params: RequestLeaveParams): StaffLeave {
    const { staffId, leaveType, startDate, endDate, reason } = params;

    if (startDate > endDate) {
      throw new ValidationError('Leave end date must be on or after start date');
    }

    // Prevent overlapping approved/pending leaves
    const overlap = this.db.get<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM staff_leaves
       WHERE staff_id = ?
         AND status IN ('pending', 'approved')
         AND starts_on <= ?
         AND ends_on >= ?`,
      [staffId, endDate, startDate],
    );
    if (overlap && overlap.cnt > 0) {
      throw new ConflictError(
        'The requested leave period overlaps with an existing approved or pending leave request',
      );
    }

    const id = newId('lve');
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO staff_leaves
         (id, staff_id, leave_type, starts_on, ends_on, status, reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [id, staffId, leaveType, startDate, endDate, reason ?? null, now, now],
    );

    return this.findById(id)!;
  }

  approveLeave(params: ApproveLeaveParams): StaffLeave {
    const leave = this.requireLeave(params.leaveId);

    if (leave.status !== 'pending') {
      throw new ValidationError(
        `Cannot approve a leave request in '${leave.status}' status — only pending requests may be approved`,
      );
    }

    // Check for conflicting confirmed/pending bookings during the leave window
    const conflicts = this.bookingsRepo.findConflictingForStaff(
      leave.staffId,
      leave.startDate,
      leave.endDate,
    );

    if (conflicts.length > 0) {
      throw new ConflictError(
        `Cannot approve leave: ${conflicts.length} confirmed or pending appointment(s) exist during this period. Reschedule or cancel them first.`,
      );
    }

    const now = new Date().toISOString();
    this.db.run(
      `UPDATE staff_leaves
       SET status = 'approved', decided_by = ?, decided_at = ?, updated_at = ?
       WHERE id = ?`,
      [params.reviewedByUserId, now, now, params.leaveId],
    );

    return this.findById(params.leaveId)!;
  }

  rejectLeave(params: RejectLeaveParams): StaffLeave {
    const leave = this.requireLeave(params.leaveId);

    if (leave.status !== 'pending') {
      throw new ValidationError(
        `Cannot reject a leave request in '${leave.status}' status — only pending requests may be rejected`,
      );
    }

    const now = new Date().toISOString();
    this.db.run(
      `UPDATE staff_leaves
       SET status = 'rejected', decided_by = ?, decided_at = ?, reject_reason = ?, updated_at = ?
       WHERE id = ?`,
      [params.reviewedByUserId, now, params.rejectReason, now, params.leaveId],
    );

    return this.findById(params.leaveId)!;
  }

  cancelLeave(leaveId: string, requestedByStaffId: string): StaffLeave {
    const leave = this.requireLeave(leaveId);

    if (leave.staffId !== requestedByStaffId) {
      throw new ConflictError('You can only cancel your own leave requests');
    }

    if (!['pending', 'approved'].includes(leave.status)) {
      throw new ValidationError(
        `Cannot cancel a leave in '${leave.status}' status`,
      );
    }

    const now = new Date().toISOString();
    this.db.run(
      `UPDATE staff_leaves SET status = 'cancelled', updated_at = ? WHERE id = ?`,
      [now, leaveId],
    );

    return this.findById(leaveId)!;
  }

  findById(id: string): StaffLeave | null {
    const row = this.db.get<LeaveRow>('SELECT * FROM staff_leaves WHERE id = ?', [id]);
    return row ? mapRow(row) : null;
  }

  listForStaff(staffId: string, status?: LeaveStatus): StaffLeave[] {
    if (status) {
      return this.db
        .all<LeaveRow>(
          'SELECT * FROM staff_leaves WHERE staff_id = ? AND status = ? ORDER BY starts_on DESC',
          [staffId, status],
        )
        .map(mapRow);
    }
    return this.db
      .all<LeaveRow>(
        'SELECT * FROM staff_leaves WHERE staff_id = ? ORDER BY starts_on DESC',
        [staffId],
      )
      .map(mapRow);
  }

  /**
   * Check if a staff member is on approved leave on a given date (YYYY-MM-DD).
   * Used by the availability engine to block booking slots.
   */
  isOnLeave(staffId: string, date: string): boolean {
    const row = this.db.get<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM staff_leaves
       WHERE staff_id = ?
         AND status = 'approved'
         AND starts_on <= ?
         AND ends_on >= ?`,
      [staffId, date, date],
    );
    return Boolean(row && row.cnt > 0);
  }

  private requireLeave(id: string): StaffLeave {
    const leave = this.findById(id);
    if (!leave) throw new NotFoundError('StaffLeave', id);
    return leave;
  }
}
