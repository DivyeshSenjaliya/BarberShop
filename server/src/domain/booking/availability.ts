import { ValidationError } from '../../core/errors';
import type { Logger } from '../../core/logger';
import {
  dayOfWeek,
  formatTime,
  gapsBetween,
  fitsWithin,
  isValidDay,
  parseTime,
  zonedTimeToUtc,
  type MinutesOfDay,
  type TimeRange,
} from '../../core/time';
import { BookingsRepository } from '../../db/repositories/bookings';
import { ShopsRepository } from '../../db/repositories/shops';
import { StaffRepository, type StaffRecord } from '../../db/repositories/staff';
import type { Db } from '../../db/sqlite';

export interface AvailabilityDeps {
  db: Db;
  logger: Logger;
}

export interface GetAvailableSlotsParams {
  branchId: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  bufferMinutes?: number;
  slotIntervalMinutes?: number;
  now?: Date;
}

export interface AvailableSlot {
  branchId: string;
  staffId: string;
  startsAt: string; // UTC ISO string
  endsAt: string; // UTC ISO string
  timeLabel: string; // "09:00"
  durationMinutes: number;
}

export class AvailabilityService {
  private readonly shopsRepo: ShopsRepository;
  private readonly staffRepo: StaffRepository;
  private readonly bookingsRepo: BookingsRepository;

  constructor(private readonly deps: AvailabilityDeps) {
    this.shopsRepo = new ShopsRepository(deps.db);
    this.staffRepo = new StaffRepository(deps.db);
    this.bookingsRepo = new BookingsRepository(deps.db);
  }

  getStaffForService(branchId: string, serviceId: string): StaffRecord[] {
    const branch = this.shopsRepo.requireBranchById(branchId);
    return this.staffRepo.listStaff({
      shopId: branch.shopId,
      branchId,
      serviceId,
      status: 'active',
      canAcceptBookings: true,
    });
  }

  getAvailableSlots(params: GetAvailableSlotsParams): AvailableSlot[] {
    const {
      branchId,
      staffId,
      date,
      durationMinutes,
      bufferMinutes = 0,
      slotIntervalMinutes = 15,
      now = new Date(),
    } = params;

    if (!isValidDay(date)) {
      throw new ValidationError(`Invalid date '${date}', expected YYYY-MM-DD`);
    }
    if (durationMinutes <= 0) {
      throw new ValidationError('durationMinutes must be greater than 0');
    }

    // 1. Branch verification
    const branch = this.shopsRepo.requireBranchById(branchId);
    if (branch.status !== 'active') {
      return [];
    }
    if (this.shopsRepo.isHoliday(branchId, date)) {
      return [];
    }

    const weekday = dayOfWeek(date);
    const branchHours = this.shopsRepo
      .listBusinessHours(branchId)
      .find((h) => h.weekday === weekday);

    if (!branchHours || branchHours.closed || !branchHours.opensAt || !branchHours.closesAt) {
      return [];
    }

    const branchWindow: TimeRange = {
      start: parseTime(branchHours.opensAt),
      end: parseTime(branchHours.closesAt),
    };

    // 2. Staff verification
    const staff = this.staffRepo.requireStaffById(staffId);
    if (staff.status !== 'active' || !staff.canAcceptBookings) {
      return [];
    }

    const staffBranches = this.staffRepo.getStaffBranches(staffId);
    if (!staffBranches.some((b) => b.branchId === branchId)) {
      return [];
    }

    // Check availability override
    const override = this.staffRepo.getOverrideForDate(staffId, date);
    let staffRange: TimeRange | null = null;

    if (override) {
      if (!override.available || !override.startsAt || !override.endsAt) {
        return [];
      }
      staffRange = {
        start: parseTime(override.startsAt),
        end: parseTime(override.endsAt),
      };
    } else {
      // Check approved leaves
      const leaves = this.staffRepo.listLeaves(staffId, { status: 'approved' });
      if (leaves.some((l) => l.startsOn <= date && date <= l.endsOn && !l.halfDay)) {
        return [];
      }

      // Check recurring weekly schedule
      const schedules = this.staffRepo
        .getStaffSchedules(staffId)
        .filter((s) => s.weekday === weekday);

      if (schedules.length === 0) {
        return [];
      }

      staffRange = {
        start: parseTime(schedules[0]!.startsAt),
        end: parseTime(schedules[0]!.endsAt),
      };
    }

    // 3. Effective working window (intersection of branch hours & staff shift)
    const workingStart = Math.max(branchWindow.start, staffRange.start);
    const workingEnd = Math.min(branchWindow.end, staffRange.end);

    if (workingStart >= workingEnd || workingEnd - workingStart < durationMinutes) {
      return [];
    }

    const effectiveWindow: TimeRange = {
      start: workingStart,
      end: workingEnd,
    };

    // 4. Blocked ranges: breaks + active appointments
    const breakRanges: TimeRange[] = this.staffRepo
      .getStaffBreaks(staffId)
      .filter((b) => b.weekday === weekday)
      .map((b) => ({
        start: parseTime(b.startsAt),
        end: parseTime(b.endsAt),
      }));

    const appointments = this.bookingsRepo
      .list({ staffId, date, includeDeleted: false })
      .filter((a) => a.status !== 'cancelled' && a.status !== 'no_show');

    const appointmentRanges: TimeRange[] = appointments.map((apt) => {
      const dStart = new Date(apt.startsAt);
      const dEnd = new Date(apt.endsAt);
      const startMin: MinutesOfDay = dStart.getUTCHours() * 60 + dStart.getUTCMinutes();
      const endMin: MinutesOfDay = Math.min(
        dEnd.getUTCHours() * 60 + dEnd.getUTCMinutes() + apt.bufferMinutes,
        24 * 60 - 1,
      );
      return { start: startMin, end: endMin };
    });

    const blocked = [...breakRanges, ...appointmentRanges];
    const freeGaps = gapsBetween(effectiveWindow, blocked);

    // 5. Candidate slot evaluation
    const slots: AvailableSlot[] = [];
    const totalSlotBlock = durationMinutes + bufferMinutes;

    for (
      let cursor = workingStart;
      cursor + durationMinutes <= workingEnd;
      cursor += slotIntervalMinutes
    ) {
      const candidate: TimeRange = {
        start: cursor,
        end: cursor + totalSlotBlock,
      };

      // Ensure the duration + buffer fits within an available gap
      if (fitsWithin(candidate, freeGaps)) {
        const startsAt = zonedTimeToUtc(date, cursor, 0);
        const endsAt = zonedTimeToUtc(date, cursor + durationMinutes, 0);

        // Exclude past slots if checking today
        if (new Date(startsAt) > now) {
          slots.push({
            branchId,
            staffId,
            startsAt,
            endsAt,
            timeLabel: formatTime(cursor),
            durationMinutes,
          });
        }
      }
    }

    return slots;
  }
}
