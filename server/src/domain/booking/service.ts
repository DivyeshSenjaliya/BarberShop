import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors';
import type { Logger } from '../../core/logger';
import {
  BookingsRepository,
  type AppointmentRecord,
  type AppointmentStatus,
  type AppointmentWithDetailsRecord,
  type CreateAppointmentServiceInput,
} from '../../db/repositories/bookings';
import { ServicesRepository } from '../../db/repositories/services';
import { ShopsRepository } from '../../db/repositories/shops';
import { StaffRepository } from '../../db/repositories/staff';
import type { Db } from '../../db/sqlite';
import { assertCan, type Role } from '../auth/rbac';
import { AvailabilityService } from './availability';

export interface BookingsServiceDeps {
  db: Db;
  logger: Logger;
}

export interface Actor {
  userId: string;
  role: Role;
}

export interface CreateBookingInput {
  branchId: string;
  staffId: string;
  serviceIds: string[];
  startsAt: string; // ISO string
  notes?: string | null;
}

export interface RescheduleBookingInput {
  newStartsAt: string; // ISO string
  reason?: string | null;
}

const CANCELLATION_DEADLINE_MS = 2 * 60 * 60 * 1000; // 2 hours notice for customer cancellation

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export class BookingsService {
  private readonly bookingsRepo: BookingsRepository;
  private readonly shopsRepo: ShopsRepository;
  private readonly staffRepo: StaffRepository;
  private readonly servicesRepo: ServicesRepository;
  private readonly availabilityService: AvailabilityService;

  constructor(private readonly deps: BookingsServiceDeps) {
    this.bookingsRepo = new BookingsRepository(deps.db);
    this.shopsRepo = new ShopsRepository(deps.db);
    this.staffRepo = new StaffRepository(deps.db);
    this.servicesRepo = new ServicesRepository(deps.db);
    this.availabilityService = new AvailabilityService(deps);
  }

  createBooking(actor: Actor, input: CreateBookingInput): AppointmentWithDetailsRecord {
    assertCan(actor.role, 'appointment:book');

    if (!input.serviceIds || input.serviceIds.length === 0) {
      throw new ValidationError('At least one service must be selected');
    }

    const branch = this.shopsRepo.requireBranchById(input.branchId);
    if (branch.status !== 'active') {
      throw new ValidationError('This branch is not currently accepting bookings');
    }

    const staff = this.staffRepo.requireStaffById(input.staffId);
    if (staff.status !== 'active' || !staff.canAcceptBookings) {
      throw new ValidationError('This staff member is not currently accepting bookings');
    }

    // Verify staff skills for all requested services
    const staffSkillIds = new Set(this.staffRepo.getStaffServiceIds(input.staffId));
    for (const srvId of input.serviceIds) {
      if (!staffSkillIds.has(srvId)) {
        throw new ValidationError(`Staff member '${staff.displayName}' cannot perform service '${srvId}'`);
      }
    }

    // Fetch effective service pricing and durations
    const branchServices = this.servicesRepo.listServicesForBranch(input.branchId, { enabledOnly: true });
    const serviceItems: CreateAppointmentServiceInput[] = [];
    let totalDurationMinutes = 0;
    let maxBufferMinutes = 0;
    let totalPriceCents = 0;

    for (let i = 0; i < input.serviceIds.length; i++) {
      const srvId = input.serviceIds[i]!;
      const branchSrv = branchServices.find((s) => s.id === srvId);
      if (!branchSrv) {
        throw new ValidationError(`Service '${srvId}' is not available at this branch`);
      }

      serviceItems.push({
        serviceId: srvId,
        serviceName: branchSrv.name,
        durationMinutes: branchSrv.durationMinutes,
        priceCents: branchSrv.effectivePriceCents,
        sortOrder: i,
      });

      totalDurationMinutes += branchSrv.durationMinutes;
      maxBufferMinutes = Math.max(maxBufferMinutes, branchSrv.bufferMinutes);
      totalPriceCents += branchSrv.effectivePriceCents;
    }

    // Calculate appointment start and end timestamps
    const startDate = new Date(input.startsAt);
    if (Number.isNaN(startDate.getTime())) {
      throw new ValidationError(`Invalid startsAt timestamp: ${input.startsAt}`);
    }

    const appointmentDate = input.startsAt.slice(0, 10);
    const endsDate = new Date(startDate.getTime() + totalDurationMinutes * 60_000);
    const endsAt = endsDate.toISOString();

    // Check staff availability slots for this day
    const availableSlots = this.availabilityService.getAvailableSlots({
      branchId: input.branchId,
      staffId: input.staffId,
      date: appointmentDate,
      durationMinutes: totalDurationMinutes,
      bufferMinutes: maxBufferMinutes,
      slotIntervalMinutes: 5, // Exact check
      now: new Date(Date.now() - 60_000), // slight grace for clock skew
    });

    const isSlotAvailable = availableSlots.some((slot) => slot.startsAt === input.startsAt);
    if (!isSlotAvailable) {
      throw new ConflictError('The requested time slot is not available for this staff member');
    }

    // Server-side conflict detection to prevent double bookings
    const conflicts = this.bookingsRepo.findConflicts(input.staffId, input.startsAt, endsAt);
    if (conflicts.length > 0) {
      throw new ConflictError('This time slot overlaps with an existing appointment');
    }

    const appointment = this.bookingsRepo.create(
      {
        shopId: branch.shopId,
        branchId: input.branchId,
        customerId: actor.userId,
        staffId: input.staffId,
        status: 'confirmed',
        appointmentDate,
        startsAt: input.startsAt,
        endsAt,
        durationMinutes: totalDurationMinutes,
        bufferMinutes: maxBufferMinutes,
        totalPriceCents,
        currency: 'USD',
        notes: input.notes ?? null,
      },
      serviceItems,
    );

    this.deps.logger.info('appointment booked', {
      appointmentId: appointment.id,
      customerId: actor.userId,
      staffId: input.staffId,
      startsAt: input.startsAt,
      totalPriceCents,
    });

    return appointment;
  }

  getAppointment(actor: Actor, appointmentId: string): AppointmentWithDetailsRecord {
    const apt = this.bookingsRepo.findWithDetails(appointmentId);
    if (!apt) {
      throw new NotFoundError('Appointment', appointmentId);
    }

    this.assertCanViewAppointment(actor, apt);
    return apt;
  }

  listMyAppointments(customerId: string, options: { status?: AppointmentStatus } = {}): AppointmentRecord[] {
    return this.bookingsRepo.list({
      customerId,
      status: options.status,
    });
  }

  listBranchAppointments(
    actor: Actor,
    branchId: string,
    options: { date?: string; status?: AppointmentStatus } = {},
  ): AppointmentRecord[] {
    assertCan(actor.role, 'appointment:read:shop');
    return this.bookingsRepo.list({
      branchId,
      date: options.date,
      status: options.status,
    });
  }

  listStaffAppointments(
    actor: Actor,
    staffId: string,
    options: { date?: string; status?: AppointmentStatus } = {},
  ): AppointmentRecord[] {
    if (actor.role === 'customer') {
      throw new ForbiddenError('Customers cannot inspect staff schedules directly');
    }
    return this.bookingsRepo.list({
      staffId,
      date: options.date,
      status: options.status,
    });
  }

  updateAppointmentStatus(
    actor: Actor,
    appointmentId: string,
    newStatus: AppointmentStatus,
    reason?: string | null,
  ): AppointmentRecord {
    assertCan(actor.role, 'appointment:write:shop');
    const apt = this.bookingsRepo.requireById(appointmentId);

    const allowedTransitions = VALID_TRANSITIONS[apt.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition appointment from status '${apt.status}' to '${newStatus}'`,
      );
    }

    const updated = this.bookingsRepo.updateStatus(appointmentId, newStatus, actor.userId, reason);
    this.deps.logger.info('appointment status updated', {
      appointmentId,
      fromStatus: apt.status,
      toStatus: newStatus,
      changedBy: actor.userId,
    });
    return updated;
  }

  cancelBooking(actor: Actor, appointmentId: string, reason: string): AppointmentRecord {
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError('A cancellation reason is required');
    }

    const apt = this.bookingsRepo.requireById(appointmentId);
    if (apt.status === 'cancelled') {
      throw new ValidationError('This appointment has already been cancelled');
    }
    if (apt.status === 'completed') {
      throw new ValidationError('Completed appointments cannot be cancelled');
    }

    const isCustomer = actor.role === 'customer' && apt.customerId === actor.userId;
    const isStaffOrManagement =
      actor.role === 'admin' ||
      actor.role === 'owner' ||
      actor.role === 'manager' ||
      actor.role === 'barber';

    if (!isCustomer && !isStaffOrManagement) {
      throw new ForbiddenError('You do not have permission to cancel this appointment');
    }

    // Customers must cancel ahead of the cancellation deadline
    if (isCustomer) {
      const startsAtTime = new Date(apt.startsAt).getTime();
      const nowTime = Date.now();
      if (startsAtTime - nowTime < CANCELLATION_DEADLINE_MS) {
        throw new ValidationError(
          'Appointments can only be cancelled at least 2 hours prior to the scheduled start time',
        );
      }
    }

    const updated = this.bookingsRepo.cancel(appointmentId, reason.trim(), actor.userId);
    this.deps.logger.info('appointment cancelled', {
      appointmentId,
      cancelledBy: actor.userId,
      reason,
    });
    return updated;
  }

  rescheduleBooking(
    actor: Actor,
    appointmentId: string,
    input: RescheduleBookingInput,
  ): AppointmentRecord {
    const apt = this.bookingsRepo.requireById(appointmentId);

    if (apt.status !== 'confirmed' && apt.status !== 'pending') {
      throw new ValidationError(`Cannot reschedule appointment with status '${apt.status}'`);
    }

    const isCustomer = actor.role === 'customer' && apt.customerId === actor.userId;
    const isStaffOrManagement =
      actor.role === 'admin' ||
      actor.role === 'owner' ||
      actor.role === 'manager' ||
      actor.role === 'barber';

    if (!isCustomer && !isStaffOrManagement) {
      throw new ForbiddenError('You do not have permission to reschedule this appointment');
    }

    const newStart = new Date(input.newStartsAt);
    if (Number.isNaN(newStart.getTime())) {
      throw new ValidationError(`Invalid timestamp: ${input.newStartsAt}`);
    }

    const newAppointmentDate = input.newStartsAt.slice(0, 10);
    const newEndsAt = new Date(newStart.getTime() + apt.durationMinutes * 60_000).toISOString();

    // Verify slot availability
    const availableSlots = this.availabilityService.getAvailableSlots({
      branchId: apt.branchId,
      staffId: apt.staffId,
      date: newAppointmentDate,
      durationMinutes: apt.durationMinutes,
      bufferMinutes: apt.bufferMinutes,
      slotIntervalMinutes: 5,
    });

    const isSlotAvailable = availableSlots.some((slot) => slot.startsAt === input.newStartsAt);
    if (!isSlotAvailable) {
      throw new ConflictError('The requested new time slot is not available for this staff member');
    }

    // Check conflict excluding this appointment
    const conflicts = this.bookingsRepo.findConflicts(
      apt.staffId,
      input.newStartsAt,
      newEndsAt,
      appointmentId,
    );
    if (conflicts.length > 0) {
      throw new ConflictError('The requested new time slot conflicts with another appointment');
    }

    const updated = this.bookingsRepo.reschedule(
      appointmentId,
      newAppointmentDate,
      input.newStartsAt,
      newEndsAt,
      actor.userId,
    );

    this.deps.logger.info('appointment rescheduled', {
      appointmentId,
      rescheduledBy: actor.userId,
      oldStartsAt: apt.startsAt,
      newStartsAt: input.newStartsAt,
    });
    return updated;
  }

  private assertCanViewAppointment(actor: Actor, apt: AppointmentRecord): void {
    if (actor.role === 'admin') return;
    if (actor.userId === apt.customerId) return;
    if (actor.role === 'owner' || actor.role === 'manager' || actor.role === 'barber') return;

    throw new ForbiddenError('You do not have permission to view this appointment');
  }
}
