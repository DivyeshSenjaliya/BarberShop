import {
  MoneyError,
  addCents,
  applyPercent,
  clampCents,
  discountAmount,
  formatMoney,
  fromCents,
  roundHalfAwayFromZero,
  splitCents,
  subtractCents,
  sumCents,
  toCents,
} from './money';

describe('toCents', () => {
  it('converts decimal strings without float drift', () => {
    expect(toCents('19.99')).toBe(1999);
    expect(toCents('0.1')).toBe(10);
    expect(toCents('0.07')).toBe(7);
    expect(toCents('100')).toBe(10000);
    expect(toCents('-4.20')).toBe(-420);
  });

  it('rounds half cents away from zero', () => {
    expect(toCents('1.005')).toBe(101);
    expect(toCents('1.004')).toBe(100);
    expect(toCents('-1.005')).toBe(-101);
  });

  it('accepts numbers', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0)).toBe(0);
  });

  it('rejects malformed amounts', () => {
    expect(() => toCents('free')).toThrow(MoneyError);
    expect(() => toCents('19.99.1')).toThrow(MoneyError);
    expect(() => toCents('')).toThrow(MoneyError);
    expect(() => toCents(Number.NaN)).toThrow(MoneyError);
    expect(() => toCents(1e12)).not.toThrow();
  });
});

describe('formatting', () => {
  it('formats cents as currency', () => {
    expect(formatMoney(1999)).toBe('$19.99');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(-250)).toBe('-$2.50');
    expect(formatMoney(1999, 'EUR', 'de-DE')).toContain('19,99');
  });

  it('round-trips through fromCents', () => {
    expect(fromCents(toCents('45.50'))).toBe(45.5);
  });
});

describe('arithmetic', () => {
  it('adds, subtracts and sums', () => {
    expect(addCents(100, 250, -50)).toBe(300);
    expect(sumCents([100, 200, 300])).toBe(600);
    expect(subtractCents(1000, 250)).toBe(750);
  });

  it('rejects non-integer cents', () => {
    expect(() => addCents(10.5, 1)).toThrow(MoneyError);
  });

  it('clamps within bounds and rejects inverted bounds', () => {
    expect(clampCents(500, 100, 300)).toBe(300);
    expect(clampCents(-5, 100, 300)).toBe(100);
    expect(() => clampCents(1, 300, 100)).toThrow(MoneyError);
  });

  it('rounds half away from zero', () => {
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(1.4)).toBe(1);
  });
});

describe('applyPercent', () => {
  it('applies percentage points', () => {
    expect(applyPercent(10000, 20)).toBe(2000);
    expect(applyPercent(333, 15)).toBe(50);
    expect(applyPercent(100, 0)).toBe(0);
  });

  it('rounds the produced cents', () => {
    expect(applyPercent(105, 50)).toBe(53);
    expect(applyPercent(-105, 50)).toBe(-53);
  });

  it('rejects non-finite percents', () => {
    expect(() => applyPercent(100, Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });
});

describe('discountAmount', () => {
  it('computes percentage discounts', () => {
    expect(discountAmount({ subtotal: 5000, percent: 10 })).toBe(500);
  });

  it('computes fixed discounts', () => {
    expect(discountAmount({ subtotal: 5000, fixed: 1500 })).toBe(1500);
  });

  it('never discounts below zero', () => {
    expect(discountAmount({ subtotal: 500, fixed: 5000 })).toBe(500);
  });

  it('honours a maximum discount cap', () => {
    expect(discountAmount({ subtotal: 20000, percent: 50, maxDiscount: 2500 })).toBe(2500);
  });

  it('requires exactly one discount basis', () => {
    expect(() => discountAmount({ subtotal: 100 })).toThrow(MoneyError);
    expect(() => discountAmount({ subtotal: -100, percent: 10 })).toThrow(MoneyError);
  });
});

describe('splitCents', () => {
  it('splits evenly when it divides exactly', () => {
    expect(splitCents(300, [1, 1, 1])).toEqual([100, 100, 100]);
  });

  it('distributes the remainder so the parts sum to the total', () => {
    const parts = splitCents(1000, [1, 1, 1]);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
  });

  it('splits by weights, e.g. commission shares', () => {
    expect(splitCents(10000, [70, 30])).toEqual([7000, 3000]);
    expect(splitCents(9999, [60, 40])).toEqual([5999, 4000]);
    expect(splitCents(9999, [60, 40]).reduce((sum, value) => sum + value, 0)).toBe(9999);
  });

  it('handles negative totals (refunds) without losing cents', () => {
    const parts = splitCents(-1000, [1, 2]);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(-1000);
  });

  it('rejects degenerate weights', () => {
    expect(() => splitCents(100, [])).toThrow(MoneyError);
    expect(() => splitCents(100, [0, 0])).toThrow(MoneyError);
    expect(() => splitCents(100, [1, -1])).toThrow(MoneyError);
  });
});
