import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../core/config';
import type { Logger } from '../../core/logger';
import type { Db } from '../../db/sqlite';
import type { Role } from '../../domain/auth/rbac';
import { AvailabilityService } from '../../domain/booking/availability';
import { BookingsService, type Actor } from '../../domain/booking/service';
import { asyncHandler } from '../asyncHandler';
import { authenticate, currentPrincipal, requireAuth, requirePermission } from '../middleware/auth';
import { sendCreated, sendOk } from '../responses';
import { parseBody, parseQuery } from '../validate';

export interface BookingsRouterDeps {
  db: Db;
  config: AppConfig;
  logger: Logger;
  bookings: BookingsService;
  availability: AvailabilityService;
}

function actorFrom(res: Response): Actor {
  const p = currentPrincipal(res);
  return { userId: p.userId, role: p.role as Role };
}

// Schemas
const GetSlotsQuerySchema = z.object({
  branchId: z.string().min(1),
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  bufferMinutes: z.coerce.number().int().min(0).max(120).optional(),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(60).optional(),
});

const GetStaffQuerySchema = z.object({
  branchId: z.string().min(1),
  serviceId: z.string().min(1),
});

const CreateBookingSchema = z.object({
  branchId: z.string().min(1),
  staffId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1, 'Select at least one service'),
  startsAt: z.string().datetime(),
  notes: z.string().trim().max(1000).nullish(),
});

const UpdateStatusSchema = z.object({
  status: z.enum(['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
  reason: z.string().trim().max(500).nullish(),
});

const CancelBookingSchema = z.object({
  reason: z.string().trim().min(2, 'Cancellation reason is required').max(500),
});

const RescheduleBookingSchema = z.object({
  newStartsAt: z.string().datetime(),
  reason: z.string().trim().max(500).nullish(),
});

export function createBookingsRouter(deps: BookingsRouterDeps): Router {
  const router = Router();
  const auth = authenticate(deps);
  const { bookings, availability } = deps;

  // ---------------------------------------------------------------------------
  // Availability (Public queries for customer booking flow)
  // ---------------------------------------------------------------------------

  router.get(
    '/availability/slots',
    asyncHandler((req, res) => {
      const query = parseQuery(GetSlotsQuerySchema, req);
      const slots = availability.getAvailableSlots(query);
      sendOk(res, { slots });
    }),
  );

  router.get(
    '/availability/staff',
    asyncHandler((req, res) => {
      const query = parseQuery(GetStaffQuerySchema, req);
      const staff = availability.getStaffForService(query.branchId, query.serviceId);
      sendOk(res, { staff });
    }),
  );

  // ---------------------------------------------------------------------------
  // Bookings / Appointments
  // ---------------------------------------------------------------------------

  router.post(
    '/bookings',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const body = parseBody(CreateBookingSchema, req);
      const appointment = bookings.createBooking(actorFrom(res), body);
      sendCreated(res, { appointment });
    }),
  );

  router.get(
    '/bookings/me',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const query = parseQuery(
        z.object({
          status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
        }),
        req,
      );
      const actor = actorFrom(res);
      const appointments = bookings.listMyAppointments(actor.userId, query);
      sendOk(res, { appointments });
    }),
  );

  router.get(
    '/bookings/:appointmentId',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const appointment = bookings.getAppointment(actorFrom(res), req.params.appointmentId!);
      sendOk(res, { appointment });
    }),
  );

  router.patch(
    '/bookings/:appointmentId/status',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const body = parseBody(UpdateStatusSchema, req);
      const appointment = bookings.updateAppointmentStatus(
        actorFrom(res),
        req.params.appointmentId!,
        body.status,
        body.reason,
      );
      sendOk(res, { appointment });
    }),
  );

  router.post(
    '/bookings/:appointmentId/cancel',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const body = parseBody(CancelBookingSchema, req);
      const appointment = bookings.cancelBooking(
        actorFrom(res),
        req.params.appointmentId!,
        body.reason,
      );
      sendOk(res, { appointment });
    }),
  );

  router.post(
    '/bookings/:appointmentId/reschedule',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const body = parseBody(RescheduleBookingSchema, req);
      const appointment = bookings.rescheduleBooking(
        actorFrom(res),
        req.params.appointmentId!,
        body,
      );
      sendOk(res, { appointment });
    }),
  );

  router.get(
    '/branches/:branchId/bookings',
    auth,
    requirePermission('appointment:read:shop'),
    asyncHandler((req, res) => {
      const query = parseQuery(
        z.object({
          date: z.string().optional(),
          status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
        }),
        req,
      );
      const appointments = bookings.listBranchAppointments(actorFrom(res), req.params.branchId!, query);
      sendOk(res, { appointments });
    }),
  );

  router.get(
    '/staff/:staffId/bookings',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const query = parseQuery(
        z.object({
          date: z.string().optional(),
          status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
        }),
        req,
      );
      const appointments = bookings.listStaffAppointments(actorFrom(res), req.params.staffId!, query);
      sendOk(res, { appointments });
    }),
  );

  return router;
}
