import { newId } from '../../core/ids';
import type { Db } from '../sqlite';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partially_refunded' | 'refunded' | 'void';
export type PaymentMethod = 'card' | 'cash' | 'wallet' | 'online';
export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'refunded' | 'partially_refunded';
export type RefundStatus = 'pending' | 'approved' | 'processed' | 'rejected' | 'failed';

export interface InvoiceRecord {
  id: string;
  appointmentId: string | null;
  customerId: string;
  shopId: string;
  invoiceNumber: string;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface InvoiceRow {
  id: string;
  appointment_id: string | null;
  customer_id: string;
  shop_id: string;
  invoice_number: string;
  subtotal_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  status: InvoiceStatus;
  issued_at: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string | null;
  appointmentId: string | null;
  customerId: string;
  shopId: string;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  provider: string;
  providerTxId: string | null;
  status: PaymentStatus;
  failureReason: string | null;
  idempotencyKey: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface PaymentRow {
  id: string;
  invoice_id: string | null;
  appointment_id: string | null;
  customer_id: string;
  shop_id: string;
  amount_cents: number;
  currency: string;
  method: PaymentMethod;
  provider: string;
  provider_tx_id: string | null;
  status: PaymentStatus;
  failure_reason: string | null;
  idempotency_key: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RefundRecord {
  id: string;
  paymentId: string;
  amountCents: number;
  currency: string;
  status: RefundStatus;
  reason: string;
  requestedBy: string;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RefundRow {
  id: string;
  payment_id: string;
  amount_cents: number;
  currency: string;
  status: RefundStatus;
  reason: string;
  requested_by: string;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapInvoiceRow(row: InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    customerId: row.customer_id,
    shopId: row.shop_id,
    invoiceNumber: row.invoice_number,
    subtotalCents: row.subtotal_cents,
    taxCents: row.tax_cents,
    discountCents: row.discount_cents,
    totalCents: row.total_cents,
    currency: row.currency,
    status: row.status,
    issuedAt: row.issued_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapPaymentRow(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    appointmentId: row.appointment_id,
    customerId: row.customer_id,
    shopId: row.shop_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    method: row.method,
    provider: row.provider,
    providerTxId: row.provider_tx_id,
    status: row.status,
    failureReason: row.failure_reason,
    idempotencyKey: row.idempotency_key,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapRefundRow(row: RefundRow): RefundRecord {
  return {
    id: row.id,
    paymentId: row.payment_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    reason: row.reason,
    requestedBy: row.requested_by,
    processedBy: row.processed_by,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const InvoiceSelectColumns = `
  id, appointment_id, customer_id, shop_id, invoice_number, subtotal_cents,
  tax_cents, discount_cents, total_cents, currency, status, issued_at,
  paid_at, created_at, updated_at, deleted_at`;

const PaymentSelectColumns = `
  id, invoice_id, appointment_id, customer_id, shop_id, amount_cents,
  currency, method, provider, provider_tx_id, status, failure_reason,
  idempotency_key, metadata, created_at, updated_at, deleted_at`;

const RefundSelectColumns = `
  id, payment_id, amount_cents, currency, status, reason, requested_by,
  processed_by, processed_at, created_at, updated_at`;

export interface CreateInvoiceInput {
  id?: string;
  appointmentId?: string | null;
  customerId: string;
  shopId: string;
  invoiceNumber?: string;
  subtotalCents: number;
  taxCents?: number;
  discountCents?: number;
  totalCents: number;
  currency?: string;
  status?: InvoiceStatus;
}

export interface CreatePaymentInput {
  id?: string;
  invoiceId?: string | null;
  appointmentId?: string | null;
  customerId: string;
  shopId: string;
  amountCents: number;
  currency?: string;
  method: PaymentMethod;
  provider?: string;
  providerTxId?: string | null;
  status?: PaymentStatus;
  idempotencyKey?: string | null;
  metadata?: string | null;
}

export interface CreateRefundInput {
  id?: string;
  paymentId: string;
  amountCents: number;
  currency?: string;
  reason: string;
  requestedBy: string;
}

export class PaymentsRepository {
  constructor(private readonly db: Db) {}

  // ---------------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------------

  createInvoice(input: CreateInvoiceInput): InvoiceRecord {
    const id = input.id ?? newId('inv');
    const now = new Date().toISOString();
    const invoiceNumber = input.invoiceNumber ?? `INV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    this.db.run(
      `INSERT INTO invoices (
         id, appointment_id, customer_id, shop_id, invoice_number, subtotal_cents,
         tax_cents, discount_cents, total_cents, currency, status, issued_at,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.appointmentId ?? null,
        input.customerId,
        input.shopId,
        invoiceNumber,
        input.subtotalCents,
        input.taxCents ?? 0,
        input.discountCents ?? 0,
        input.totalCents,
        input.currency ?? 'USD',
        input.status ?? 'issued',
        now,
        now,
        now,
      ],
    );

    return this.requireInvoiceById(id);
  }

  findInvoiceById(id: string): InvoiceRecord | null {
    const row = this.db.get<InvoiceRow>(
      `SELECT ${InvoiceSelectColumns} FROM invoices WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return row ? mapInvoiceRow(row) : null;
  }

  requireInvoiceById(id: string): InvoiceRecord {
    const inv = this.findInvoiceById(id);
    if (!inv) throw new Error(`invoice '${id}' not found`);
    return inv;
  }

  findInvoiceByNumber(invoiceNumber: string): InvoiceRecord | null {
    const row = this.db.get<InvoiceRow>(
      `SELECT ${InvoiceSelectColumns} FROM invoices WHERE invoice_number = ? AND deleted_at IS NULL`,
      [invoiceNumber],
    );
    return row ? mapInvoiceRow(row) : null;
  }

  listInvoices(filter: { customerId?: string; shopId?: string; status?: InvoiceStatus } = {}): InvoiceRecord[] {
    const clauses = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (filter.customerId) {
      clauses.push('customer_id = ?');
      params.push(filter.customerId);
    }
    if (filter.shopId) {
      clauses.push('shop_id = ?');
      params.push(filter.shopId);
    }
    if (filter.status) {
      clauses.push('status = ?');
      params.push(filter.status);
    }

    return this.db
      .all<InvoiceRow>(
        `SELECT ${InvoiceSelectColumns} FROM invoices WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
        params,
      )
      .map(mapInvoiceRow);
  }

  updateInvoiceStatus(id: string, status: InvoiceStatus, paidAt?: string): InvoiceRecord {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE invoices SET status = ?, paid_at = COALESCE(?, paid_at), updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [status, paidAt ?? (status === 'paid' ? now : null), now, id],
    );
    return this.requireInvoiceById(id);
  }

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------

  createPayment(input: CreatePaymentInput): PaymentRecord {
    const id = input.id ?? newId('pay');
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO payments (
         id, invoice_id, appointment_id, customer_id, shop_id, amount_cents,
         currency, method, provider, provider_tx_id, status, idempotency_key,
         metadata, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.invoiceId ?? null,
        input.appointmentId ?? null,
        input.customerId,
        input.shopId,
        input.amountCents,
        input.currency ?? 'USD',
        input.method,
        input.provider ?? 'mock',
        input.providerTxId ?? null,
        input.status ?? 'pending',
        input.idempotencyKey ?? null,
        input.metadata ?? null,
        now,
        now,
      ],
    );

    return this.requirePaymentById(id);
  }

  findPaymentById(id: string): PaymentRecord | null {
    const row = this.db.get<PaymentRow>(
      `SELECT ${PaymentSelectColumns} FROM payments WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return row ? mapPaymentRow(row) : null;
  }

  requirePaymentById(id: string): PaymentRecord {
    const pay = this.findPaymentById(id);
    if (!pay) throw new Error(`payment '${id}' not found`);
    return pay;
  }

  findByIdempotencyKey(key: string): PaymentRecord | null {
    const row = this.db.get<PaymentRow>(
      `SELECT ${PaymentSelectColumns} FROM payments WHERE idempotency_key = ? AND deleted_at IS NULL`,
      [key],
    );
    return row ? mapPaymentRow(row) : null;
  }

  listPayments(filter: { customerId?: string; shopId?: string; status?: PaymentStatus } = {}): PaymentRecord[] {
    const clauses = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (filter.customerId) {
      clauses.push('customer_id = ?');
      params.push(filter.customerId);
    }
    if (filter.shopId) {
      clauses.push('shop_id = ?');
      params.push(filter.shopId);
    }
    if (filter.status) {
      clauses.push('status = ?');
      params.push(filter.status);
    }

    return this.db
      .all<PaymentRow>(
        `SELECT ${PaymentSelectColumns} FROM payments WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
        params,
      )
      .map(mapPaymentRow);
  }

  updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    providerTxId?: string | null,
    failureReason?: string | null,
  ): PaymentRecord {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE payments
       SET status = ?, provider_tx_id = COALESCE(?, provider_tx_id), failure_reason = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [status, providerTxId ?? null, failureReason ?? null, now, id],
    );
    return this.requirePaymentById(id);
  }

  // ---------------------------------------------------------------------------
  // Refunds
  // ---------------------------------------------------------------------------

  createRefund(input: CreateRefundInput): RefundRecord {
    const id = input.id ?? newId('rfnd');
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO refunds (
         id, payment_id, amount_cents, currency, status, reason, requested_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [id, input.paymentId, input.amountCents, input.currency ?? 'USD', input.reason, input.requestedBy, now, now],
    );

    const row = this.db.get<RefundRow>(`SELECT ${RefundSelectColumns} FROM refunds WHERE id = ?`, [id]);
    if (!row) throw new Error(`refund '${id}' disappeared`);
    return mapRefundRow(row);
  }

  findRefundById(id: string): RefundRecord | null {
    const row = this.db.get<RefundRow>(`SELECT ${RefundSelectColumns} FROM refunds WHERE id = ?`, [id]);
    return row ? mapRefundRow(row) : null;
  }

  listRefundsForPayment(paymentId: string): RefundRecord[] {
    return this.db
      .all<RefundRow>(
        `SELECT ${RefundSelectColumns} FROM refunds WHERE payment_id = ? ORDER BY created_at DESC`,
        [paymentId],
      )
      .map(mapRefundRow);
  }

  updateRefundStatus(id: string, status: RefundStatus, processedBy?: string): RefundRecord {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE refunds SET status = ?, processed_by = ?, processed_at = ?, updated_at = ? WHERE id = ?`,
      [status, processedBy ?? null, status === 'processed' ? now : null, now, id],
    );
    const refund = this.findRefundById(id);
    if (!refund) throw new Error(`refund '${id}' not found`);
    return refund;
  }
}
