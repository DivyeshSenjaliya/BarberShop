import {
  addDays,
  assertRange,
  compareDays,
  dayKey,
  dayOfWeek,
  daysBetween,
  durationLabel,
  fitsWithin,
  formatRange,
  formatTime,
  gapsBetween,
  isValidDay,
  isValidTime,
  mergeRanges,
  minutesOfDayInZone,
  overlaps,
  parseDay,
  parseTime,
  rangeOf,
  TimeError,
  totalMinutes,
  zonedTimeToUtc,
} from './time';

describe('parseTime / formatTime', () => {
  it('converts between HH:MM and minutes', () => {
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('9:30')).toBe(570);
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('23:59')).toBe(1439);
    expect(formatTime(570)).toBe('09:30');
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(1439)).toBe('23:59');
  });

  it('rejects malformed times', () => {
    expect(() => parseTime('24:00')).toThrow(TimeError);
    expect(() => parseTime('09:60')).toThrow(TimeError);
    expect(() => parseTime('9-30')).toThrow(TimeError);
    expect(() => formatTime(-1)).toThrow(TimeError);
    expect(isValidTime('07:15')).toBe(true);
    expect(isValidTime('7:5')).toBe(false);
  });
});

describe('day keys', () => {
  it('validates and walks days', () => {
    expect(isValidDay('2026-10-07')).toBe(true);
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('07-10-2026')).toBe(false);
    expect(addDays('2026-10-07', 1)).toBe('2026-10-08');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-10-07', '2026-10-10')).toBe(3);
    expect(daysBetween('2026-10-10', '2026-10-07')).toBe(-3);
    expect(compareDays('2026-10-07', '2026-10-08')).toBe(-1);
    expect(dayOfWeek('2026-10-07')).toBe(3); // Wednesday
    expect(dayKey(new Date('2026-10-07T23:59:59Z'))).toBe('2026-10-07');
    expect(() => parseDay('2026-13-01')).toThrow(TimeError);
  });
});

describe('ranges', () => {
  const morning = { start: 540, end: 720 }; // 09:00-12:00

  it('measures and validates', () => {
    expect(rangeOf(morning)).toBe(180);
    expect(() => assertRange({ start: 720, end: 540 })).toThrow(TimeError);
    expect(() => assertRange({ start: -1, end: 10 })).toThrow(TimeError);
    expect(formatRange(morning)).toBe('09:00-12:00');
  });

  it('detects overlap and containment', () => {
    expect(overlaps(morning, { start: 660, end: 780 })).toBe(true);
    expect(overlaps(morning, { start: 720, end: 780 })).toBe(false);
    expect(overlaps(morning, { start: 480, end: 540 })).toBe(false);
    expect(fitsWithin({ start: 540, end: 585 }, [morning])).toBe(true);
    expect(fitsWithin({ start: 690, end: 735 }, [morning])).toBe(false);
  });

  it('merges touching ranges', () => {
    expect(
      mergeRanges([
        { start: 660, end: 720 },
        { start: 540, end: 660 },
        { start: 900, end: 960 },
      ]),
    ).toEqual([
      { start: 540, end: 720 },
      { start: 900, end: 960 },
    ]);
    expect(mergeRanges([])).toEqual([]);
  });

  it('computes free gaps around blocked time', () => {
    const gaps = gapsBetween({ start: 540, end: 1020 }, [
      { start: 600, end: 660 },
      { start: 780, end: 840 },
    ]);
    expect(gaps).toEqual([
      { start: 540, end: 600 },
      { start: 660, end: 780 },
      { start: 840, end: 1020 },
    ]);
  });

  it('ignores blocks outside the window', () => {
    expect(
      gapsBetween({ start: 540, end: 720 }, [
        { start: 0, end: 300 },
        { start: 1200, end: 1400 },
      ]),
    ).toEqual([{ start: 540, end: 720 }]);
  });

  it('returns no gap when the window is fully blocked', () => {
    expect(gapsBetween({ start: 540, end: 720 }, [{ start: 540, end: 720 }])).toEqual([]);
    expect(gapsBetween({ start: 540, end: 720 }, [{ start: 500, end: 800 }])).toEqual([]);
  });

  it('totals blocked minutes without double counting overlaps', () => {
    expect(
      totalMinutes([
        { start: 600, end: 660 },
        { start: 630, end: 700 },
      ]),
    ).toBe(100);
  });
});

describe('timezone helpers', () => {
  it('converts UTC timestamps to local wall-clock minutes', () => {
    // 14:00 UTC is 09:00 in UTC-5.
    expect(minutesOfDayInZone('2026-10-07T14:00:00Z', -300)).toBe(540);
    expect(minutesOfDayInZone('2026-10-07T02:30:00Z', 120)).toBe(270);
  });

  it('round-trips through zonedTimeToUtc', () => {
    const iso = zonedTimeToUtc('2026-10-07', 540, -300);
    expect(iso).toBe('2026-10-07T14:00:00.000Z');
    expect(minutesOfDayInZone(iso, -300)).toBe(540);
  });

  it('rejects invalid timestamps', () => {
    expect(() => minutesOfDayInZone('not-a-date', 0)).toThrow(TimeError);
  });
});

describe('durationLabel', () => {
  it('formats durations', () => {
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(60)).toBe('1 hr');
    expect(durationLabel(90)).toBe('1 hr 30 min');
    expect(() => durationLabel(-5)).toThrow(TimeError);
  });
});
