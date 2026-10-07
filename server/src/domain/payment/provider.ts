export interface ChargeParams {
  amountCents: number;
  currency: string;
  customerId: string;
  paymentMethod: string;
  idempotencyKey?: string | null;
  metadata?: Record<string, string>;
}

export interface ChargeResult {
  success: boolean;
  transactionId?: string;
  failureReason?: string;
}

export interface RefundParams {
  transactionId: string;
  amountCents: number;
  currency: string;
  reason: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  failureReason?: string;
}

export interface PaymentProvider {
  readonly name: string;
  charge(params: ChargeParams): Promise<ChargeResult>;
  refund(params: RefundParams): Promise<RefundResult>;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async charge(params: ChargeParams): Promise<ChargeResult> {
    // Simulate declined card if metadata indicates simulated decline
    if (params.metadata?.simulateDecline === 'true') {
      return {
        success: false,
        failureReason: 'Your card was declined by the issuer',
      };
    }

    return {
      success: true,
      transactionId: `mock_tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    if (params.amountCents <= 0) {
      return {
        success: false,
        failureReason: 'Refund amount must be positive',
      };
    }

    return {
      success: true,
      refundId: `mock_rf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }
}
