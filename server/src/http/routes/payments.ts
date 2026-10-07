import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../core/config';
import type { Logger } from '../../core/logger';
import type { Db } from '../../db/sqlite';
import type { Role } from '../../domain/auth/rbac';
import { PaymentService, type Actor } from '../../domain/payment/service';
import { asyncHandler } from '../asyncHandler';
import { authenticate, currentPrincipal, requireAuth, requirePermission } from '../middleware/auth';
import { sendCreated, sendOk } from '../responses';
import { parseBody, parseQuery } from '../validate';

export interface PaymentsRouterDeps {
  db: Db;
  config: AppConfig;
  logger: Logger;
  payments: PaymentService;
}

function actorFrom(res: Response): Actor {
  const p = currentPrincipal(res);
  return { userId: p.userId, role: p.role as Role };
}

// Schemas
const PayInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  method: z.enum(['card', 'cash', 'wallet', 'online']),
  idempotencyKey: z.string().trim().max(128).nullish(),
  metadata: z.record(z.string()).optional(),
});

const RequestRefundSchema = z.object({
  paymentId: z.string().min(1),
  amountCents: z.number().int().min(1),
  reason: z.string().trim().min(3).max(500),
});

const TopupWalletSchema = z.object({
  amountCents: z.number().int().min(100), // minimum $1.00 topup
  paymentMethod: z.enum(['card', 'online']).default('card'),
  idempotencyKey: z.string().trim().max(128).nullish(),
});

export function createPaymentsRouter(deps: PaymentsRouterDeps): Router {
  const router = Router();
  const auth = authenticate(deps);
  const { payments } = deps;

  // ---------------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------------

  router.post(
    '/invoices/appointments/:appointmentId',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const invoice = payments.createInvoiceForAppointment(
        actorFrom(res),
        req.params.appointmentId!,
      );
      sendCreated(res, { invoice });
    }),
  );

  router.get(
    '/invoices/:invoiceId',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const invoice = payments.getInvoice(actorFrom(res), req.params.invoiceId!);
      sendOk(res, { invoice });
    }),
  );

  router.get(
    '/invoices',
    auth,
    requireAuth(),
    asyncHandler((req, res) => {
      const query = parseQuery(z.object({ shopId: z.string().optional() }), req);
      const invoices = payments.listInvoices(actorFrom(res), query);
      sendOk(res, { invoices });
    }),
  );

  // ---------------------------------------------------------------------------
  // Payments & Charges
  // ---------------------------------------------------------------------------

  router.post(
    '/payments/pay',
    auth,
    requireAuth(),
    asyncHandler(async (req, res) => {
      const body = parseBody(PayInvoiceSchema, req);
      const payment = await payments.payInvoice(actorFrom(res), body);
      sendOk(res, { payment });
    }),
  );

  // ---------------------------------------------------------------------------
  // Refunds
  // ---------------------------------------------------------------------------

  router.post(
    '/payments/refund',
    auth,
    requirePermission('refund:process'),
    asyncHandler(async (req, res) => {
      const body = parseBody(RequestRefundSchema, req);
      const refund = await payments.processRefund(actorFrom(res), body);
      sendOk(res, { refund });
    }),
  );

  // ---------------------------------------------------------------------------
  // Wallet
  // ---------------------------------------------------------------------------

  router.get(
    '/wallet',
    auth,
    requireAuth(),
    asyncHandler((_req, res) => {
      const actor = actorFrom(res);
      const wallet = payments.getWallet(actor.userId);
      sendOk(res, { wallet });
    }),
  );

  router.get(
    '/wallet/transactions',
    auth,
    requireAuth(),
    asyncHandler((_req, res) => {
      const actor = actorFrom(res);
      const transactions = payments.getWalletTransactions(actor.userId);
      sendOk(res, { transactions });
    }),
  );

  router.post(
    '/wallet/topup',
    auth,
    requireAuth(),
    asyncHandler(async (req, res) => {
      const body = parseBody(TopupWalletSchema, req);
      const result = await payments.topupWallet(
        actorFrom(res),
        body.amountCents,
        body.paymentMethod ?? 'card',
        body.idempotencyKey ?? undefined,
      );
      sendOk(res, result);
    }),
  );

  return router;
}
