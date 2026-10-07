import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors';
import type { Logger } from '../../core/logger';
import {
  PaymentsRepository,
  type InvoiceRecord,
  type PaymentMethod,
  type PaymentRecord,
  type RefundRecord,
} from '../../db/repositories/payments';
import { WalletsRepository, type WalletRecord, type WalletTransactionRecord } from '../../db/repositories/wallets';
import { BookingsRepository } from '../../db/repositories/bookings';
import type { Db } from '../../db/sqlite';
import { assertCan, type Role } from '../auth/rbac';
import { MockPaymentProvider, type PaymentProvider } from './provider';

export interface PaymentServiceDeps {
  db: Db;
  logger: Logger;
  provider?: PaymentProvider;
  taxRateBps?: number; // basis points, e.g. 800 = 8.00%
}

export interface Actor {
  userId: string;
  role: Role;
}

export interface PayInvoiceInput {
  invoiceId: string;
  method: PaymentMethod;
  idempotencyKey?: string | null;
  metadata?: Record<string, string>;
}

export interface RequestRefundInput {
  paymentId: string;
  amountCents: number;
  reason: string;
}

export class PaymentService {
  private readonly paymentsRepo: PaymentsRepository;
  private readonly walletsRepo: WalletsRepository;
  private readonly bookingsRepo: BookingsRepository;
  private readonly provider: PaymentProvider;
  private readonly taxRateBps: number;

  constructor(private readonly deps: PaymentServiceDeps) {
    this.paymentsRepo = new PaymentsRepository(deps.db);
    this.walletsRepo = new WalletsRepository(deps.db);
    this.bookingsRepo = new BookingsRepository(deps.db);
    this.provider = deps.provider ?? new MockPaymentProvider();
    this.taxRateBps = deps.taxRateBps ?? 800; // 8% default
  }

  // ---------------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------------

  createInvoiceForAppointment(actor: Actor, appointmentId: string): InvoiceRecord {
    const apt = this.bookingsRepo.requireById(appointmentId);

    if (actor.role === 'customer' && actor.userId !== apt.customerId) {
      throw new ForbiddenError('You do not have permission to generate invoice for this appointment');
    }

    const subtotalCents = apt.totalPriceCents;
    const taxCents = Math.round((subtotalCents * this.taxRateBps) / 10000);
    const discountCents = 0;
    const totalCents = subtotalCents + taxCents - discountCents;

    const invoice = this.paymentsRepo.createInvoice({
      appointmentId,
      customerId: apt.customerId,
      shopId: apt.shopId,
      subtotalCents,
      taxCents,
      discountCents,
      totalCents,
      currency: apt.currency,
      status: 'issued',
    });

    this.deps.logger.info('invoice generated for appointment', {
      invoiceId: invoice.id,
      appointmentId,
      totalCents,
    });

    return invoice;
  }

  getInvoice(actor: Actor, invoiceId: string): InvoiceRecord {
    const invoice = this.paymentsRepo.requireInvoiceById(invoiceId);
    if (actor.role === 'customer' && actor.userId !== invoice.customerId) {
      throw new ForbiddenError('You do not have permission to view this invoice');
    }
    return invoice;
  }

  listInvoices(actor: Actor, query: { shopId?: string } = {}): InvoiceRecord[] {
    if (actor.role === 'customer') {
      return this.paymentsRepo.listInvoices({ customerId: actor.userId });
    }
    return this.paymentsRepo.listInvoices({ shopId: query.shopId });
  }

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------

  async payInvoice(actor: Actor, input: PayInvoiceInput): Promise<PaymentRecord> {
    const invoice = this.paymentsRepo.requireInvoiceById(input.invoiceId);

    // Check idempotency first so duplicate retries on completed payments succeed cleanly
    if (input.idempotencyKey) {
      const existing = this.paymentsRepo.findByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        if (existing.status === 'successful') {
          return existing;
        }
        if (existing.status === 'pending') {
          throw new ConflictError('Payment with this idempotency key is already in progress');
        }
      }
    }

    if (invoice.status === 'paid') {
      throw new ConflictError('This invoice has already been paid');
    }
    if (invoice.status === 'void') {
      throw new ValidationError('Cannot pay a void invoice');
    }

    if (actor.role === 'customer' && actor.userId !== invoice.customerId) {
      throw new ForbiddenError('You do not have permission to pay this invoice');
    }

    // Record initial pending payment
    const payment = this.paymentsRepo.createPayment({
      invoiceId: invoice.id,
      appointmentId: invoice.appointmentId,
      customerId: invoice.customerId,
      shopId: invoice.shopId,
      amountCents: invoice.totalCents,
      currency: invoice.currency,
      method: input.method,
      provider: input.method === 'wallet' ? 'wallet' : this.provider.name,
      status: 'pending',
      idempotencyKey: input.idempotencyKey ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });

    // Handle payment method
    if (input.method === 'wallet') {
      try {
        const wallet = this.walletsRepo.getOrCreateWallet(invoice.customerId, invoice.currency);
        this.walletsRepo.debit(
          wallet.id,
          invoice.totalCents,
          'payment',
          payment.id,
          `Payment for Invoice ${invoice.invoiceNumber}`,
        );

        const successful = this.paymentsRepo.updatePaymentStatus(
          payment.id,
          'successful',
          `wal_tx_${payment.id}`,
        );
        this.paymentsRepo.updateInvoiceStatus(invoice.id, 'paid');
        return successful;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Wallet debit failed';
        this.paymentsRepo.updatePaymentStatus(payment.id, 'failed', null, msg);
        throw new ValidationError(`Wallet payment failed: ${msg}`);
      }
    } else if (input.method === 'cash') {
      // Cash payment requires staff or owner
      if (actor.role === 'customer') {
        throw new ForbiddenError('Customers cannot self-mark payments as paid in cash');
      }

      const successful = this.paymentsRepo.updatePaymentStatus(
        payment.id,
        'successful',
        `cash_${payment.id}`,
      );
      this.paymentsRepo.updateInvoiceStatus(invoice.id, 'paid');
      return successful;
    } else {
      // Card / Online payment via payment provider
      const chargeResult = await this.provider.charge({
        amountCents: invoice.totalCents,
        currency: invoice.currency,
        customerId: invoice.customerId,
        paymentMethod: input.method,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      });

      if (!chargeResult.success) {
        this.paymentsRepo.updatePaymentStatus(
          payment.id,
          'failed',
          null,
          chargeResult.failureReason ?? 'Transaction declined',
        );
        throw new ValidationError(
          `Payment failed: ${chargeResult.failureReason ?? 'Transaction declined'}`,
        );
      }

      const successful = this.paymentsRepo.updatePaymentStatus(
        payment.id,
        'successful',
        chargeResult.transactionId,
      );
      this.paymentsRepo.updateInvoiceStatus(invoice.id, 'paid');
      return successful;
    }
  }

  // ---------------------------------------------------------------------------
  // Refunds
  // ---------------------------------------------------------------------------

  async processRefund(actor: Actor, input: RequestRefundInput): Promise<RefundRecord> {
    assertCan(actor.role, 'refund:process');

    const payment = this.paymentsRepo.requirePaymentById(input.paymentId);
    if (payment.status !== 'successful' && payment.status !== 'partially_refunded') {
      throw new ValidationError(`Cannot refund payment with status '${payment.status}'`);
    }

    if (input.amountCents <= 0) {
      throw new ValidationError('Refund amount must be positive');
    }

    // Check existing refunds
    const existingRefunds = this.paymentsRepo.listRefundsForPayment(payment.id);
    const totalRefundedAlready = existingRefunds
      .filter((r) => r.status === 'processed')
      .reduce((sum, r) => sum + r.amountCents, 0);

    if (totalRefundedAlready + input.amountCents > payment.amountCents) {
      throw new ValidationError(
        `Refund amount exceeds remaining refundable balance (${payment.amountCents - totalRefundedAlready} cents available)`,
      );
    }

    const refund = this.paymentsRepo.createRefund({
      paymentId: payment.id,
      amountCents: input.amountCents,
      currency: payment.currency,
      reason: input.reason,
      requestedBy: actor.userId,
    });

    if (payment.method === 'wallet') {
      const wallet = this.walletsRepo.getOrCreateWallet(payment.customerId, payment.currency);
      this.walletsRepo.credit(
        wallet.id,
        input.amountCents,
        'refund',
        refund.id,
        `Refund for payment ${payment.id}: ${input.reason}`,
      );
    } else if (payment.method === 'card' || payment.method === 'online') {
      if (payment.providerTxId) {
        const result = await this.provider.refund({
          transactionId: payment.providerTxId,
          amountCents: input.amountCents,
          currency: payment.currency,
          reason: input.reason,
        });

        if (!result.success) {
          this.paymentsRepo.updateRefundStatus(refund.id, 'failed', actor.userId);
          throw new ValidationError(`Provider refund failed: ${result.failureReason}`);
        }
      }
    }

    const processed = this.paymentsRepo.updateRefundStatus(refund.id, 'processed', actor.userId);

    const newTotalRefunded = totalRefundedAlready + input.amountCents;
    const isFullRefund = newTotalRefunded === payment.amountCents;
    const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    this.paymentsRepo.updatePaymentStatus(payment.id, newPaymentStatus);

    if (payment.invoiceId) {
      this.paymentsRepo.updateInvoiceStatus(
        payment.invoiceId,
        isFullRefund ? 'refunded' : 'partially_refunded',
      );
    }

    this.deps.logger.info('refund processed', {
      refundId: refund.id,
      paymentId: payment.id,
      amountCents: input.amountCents,
      isFullRefund,
    });

    return processed;
  }

  // ---------------------------------------------------------------------------
  // Wallet
  // ---------------------------------------------------------------------------

  getWallet(userId: string): WalletRecord {
    return this.walletsRepo.getOrCreateWallet(userId);
  }

  getWalletTransactions(userId: string): WalletTransactionRecord[] {
    const wallet = this.walletsRepo.getOrCreateWallet(userId);
    return this.walletsRepo.listTransactions(wallet.id);
  }

  async topupWallet(
    actor: Actor,
    amountCents: number,
    paymentMethod: 'card' | 'online',
    idempotencyKey?: string,
  ): Promise<{ wallet: WalletRecord; transaction: WalletTransactionRecord }> {
    if (amountCents <= 0) {
      throw new ValidationError('Topup amount must be greater than 0');
    }

    const chargeResult = await this.provider.charge({
      amountCents,
      currency: 'USD',
      customerId: actor.userId,
      paymentMethod,
      idempotencyKey,
      metadata: { type: 'wallet_topup' },
    });

    if (!chargeResult.success) {
      throw new ValidationError(`Topup payment failed: ${chargeResult.failureReason}`);
    }

    const wallet = this.walletsRepo.getOrCreateWallet(actor.userId);
    return this.walletsRepo.credit(
      wallet.id,
      amountCents,
      'topup',
      chargeResult.transactionId,
      'Wallet top-up',
    );
  }
}
