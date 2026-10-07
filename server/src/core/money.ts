/**
 * Money arithmetic.
 *
 * All monetary values in the system are integer cents (`Cents`). Floating
 * point never touches an amount: prices, taxes, discounts, refunds and
 * commission splits are computed with integer maths and explicit rounding.
 */

export type Cents = number;
export type Percent = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

const MaxSafeCents = Number.MAX_SAFE_INTEGER;

function assertCents(value: number, label = 'amount'): Cents {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of cents, received ${value}`);
  }
  if (Math.abs(value) > MaxSafeCents) {
    throw new MoneyError(`${label} exceeds the safe integer range`);
  }
  return value;
}

/** Round half away from zero — predictable for both positive and negative values. */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Parse a decimal amount (string or number) into cents.
 * Accepts `"19.99"`, `19.99`, `"-4.20"`. Rejects garbage.
 */
export function toCents(amount: string | number): Cents {
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) throw new MoneyError(`amount is not finite: ${amount}`);
    return assertCents(roundHalfAwayFromZero(amount * 100));
  }

  const trimmed = amount.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new MoneyError(`amount is not a valid decimal: '${amount}'`);
  }
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const fractionPadded = (fraction + '00').slice(0, 3);
  const cents = Number(whole) * 100 + Number(fractionPadded.slice(0, 2));
  // A third decimal digit decides the rounding direction.
  const rounded = cents + (Number(fractionPadded[2]) >= 5 ? 1 : 0);
  return assertCents(negative ? -rounded : rounded);
}

export function fromCents(cents: Cents): number {
  return assertCents(cents) / 100;
}

export function formatMoney(cents: Cents, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    fromCents(cents),
  );
}

export function addCents(...values: Cents[]): Cents {
  return assertCents(values.reduce((total, value) => total + assertCents(value), 0), 'sum');
}

export function sumCents(values: readonly Cents[]): Cents {
  return addCents(...values);
}

export function subtractCents(left: Cents, right: Cents): Cents {
  return addCents(left, -assertCents(right));
}

export function clampCents(value: Cents, min: Cents, max: Cents): Cents {
  if (min > max) throw new MoneyError(`clamp bounds are inverted: ${min} > ${max}`);
  return Math.min(Math.max(assertCents(value), min), max);
}

/** `percent` is expressed in percent units (20 means 20%). */
export function applyPercent(amount: Cents, percent: Percent): Cents {
  if (!Number.isFinite(percent)) throw new MoneyError(`percent is not finite: ${percent}`);
  return assertCents(roundHalfAwayFromZero(assertCents(amount) * (percent / 100)));
}

export interface DiscountInput {
  subtotal: Cents;
  percent?: Percent;
  fixed?: Cents;
  /** Never let a discount push the total below zero. */
  maxDiscount?: Cents;
}

/**
 * Compute the amount taken off a subtotal for a percentage or fixed coupon.
 * Percentage wins when both are given; the result is clamped to the subtotal
 * (and to `maxDiscount` when provided).
 */
export function discountAmount(input: DiscountInput): Cents {
  const subtotal = assertCents(input.subtotal, 'subtotal');
  if (subtotal < 0) throw new MoneyError('subtotal cannot be negative');

  let discount: Cents;
  if (input.percent !== undefined) {
    discount = applyPercent(subtotal, input.percent);
  } else if (input.fixed !== undefined) {
    discount = assertCents(input.fixed, 'fixed discount');
  } else {
    throw new MoneyError('a discount needs either percent or fixed');
  }

  if (discount < 0) throw new MoneyError('discount cannot be negative');
  if (input.maxDiscount !== undefined) {
    discount = Math.min(discount, assertCents(input.maxDiscount, 'maxDiscount'));
  }
  return Math.min(discount, subtotal);
}

/**
 * Split `total` across `weights` without losing cents: any remainder from
 * integer division is handed out one cent at a time to the largest
 * fractional parts, ties broken by position. The parts always sum to total.
 */
export function splitCents(total: Cents, weights: readonly number[]): Cents[] {
  assertCents(total, 'total');
  if (weights.length === 0) throw new MoneyError('cannot split across zero weights');
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new MoneyError('split weights must be finite and non-negative');
  }
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum === 0) throw new MoneyError('split weights must not all be zero');

  const raw = weights.map((weight) => (total * weight) / weightSum);
  const floors = raw.map((value) => Math.trunc(value));
  let remainder = total - floors.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const result = [...floors];
  const step = remainder >= 0 ? 1 : -1;
  for (let position = 0; remainder !== 0; position = (position + 1) % order.length) {
    const target = order[position]!.index;
    result[target] = result[target]! + step;
    remainder -= step;
  }
  return result;
}
