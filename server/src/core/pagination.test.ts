import { ValidationError } from './errors';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildPage,
  decodeCursor,
  encodeCursor,
  parsePageParams,
} from './pagination';

describe('parsePageParams', () => {
  it('defaults the limit when nothing is given', () => {
    expect(parsePageParams({})).toEqual({ limit: DEFAULT_LIMIT });
    expect(parsePageParams({ limit: '' })).toEqual({ limit: DEFAULT_LIMIT });
  });

  it('accepts a valid limit and cursor', () => {
    expect(parsePageParams({ limit: '15', cursor: 'abc' })).toEqual({
      limit: 15,
      cursor: 'abc',
    });
  });

  it('rejects non-numeric, zero and negative limits', () => {
    expect(() => parsePageParams({ limit: 'many' })).toThrow(ValidationError);
    expect(() => parsePageParams({ limit: '0' })).toThrow(ValidationError);
    expect(() => parsePageParams({ limit: '-5' })).toThrow(ValidationError);
    expect(() => parsePageParams({ limit: '1.5' })).toThrow(ValidationError);
  });

  it('enforces the max limit', () => {
    expect(() => parsePageParams({ limit: String(MAX_LIMIT + 1) })).toThrow(/cannot exceed/);
    expect(parsePageParams({ limit: '100' }).limit).toBe(100);
    expect(() => parsePageParams({ limit: '25' }, { maxLimit: 20 })).toThrow(
      ValidationError,
    );
  });

  it('rejects non-string cursors', () => {
    expect(() => parsePageParams({ cursor: ['a'] })).toThrow(ValidationError);
  });
});

describe('cursors', () => {
  it('round-trips objects', () => {
    const payload = { id: 'srv_1', rating: 4.5 };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it('rejects tampered, garbage and non-object cursors', () => {
    expect(() => decodeCursor('!!!not base64!!!')).toThrow(ValidationError);
    expect(() => decodeCursor(Buffer.from('[1,2]').toString('base64url'))).toThrow(
      ValidationError,
    );
    expect(() => decodeCursor(Buffer.from('"a string"').toString('base64url'))).toThrow(
      ValidationError,
    );
  });
});

describe('buildPage', () => {
  interface Row {
    id: string;
  }
  const rows: Row[] = Array.from({ length: 25 }, (_, index) => ({ id: `row_${index}` }));
  const cursorFor = (row: Row) => ({ id: row.id });

  it('detects more rows than the limit and trims them', () => {
    const page = buildPage(rows.slice(0, 21), { limit: 20 }, cursorFor);
    expect(page.data).toHaveLength(20);
    expect(page.pageInfo.hasMore).toBe(true);
    expect(page.pageInfo.nextCursor).toBe(encodeCursor({ id: 'row_19' }));
  });

  it('marks the final page', () => {
    const page = buildPage(rows.slice(0, 20), { limit: 20 }, cursorFor);
    expect(page.pageInfo.hasMore).toBe(false);
    expect(page.pageInfo.nextCursor).toBeNull();
  });

  it('handles an empty result set', () => {
    const page = buildPage([], { limit: 20 }, cursorFor);
    expect(page).toEqual({
      data: [],
      pageInfo: { limit: 20, hasMore: false, nextCursor: null },
    });
  });

  it('copies the input array so callers cannot mutate the page', () => {
    const input = rows.slice(0, 3);
    const page = buildPage(input, { limit: 20 }, cursorFor);
    page.data.pop();
    expect(input).toHaveLength(3);
  });
});
