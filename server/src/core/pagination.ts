/**
 * Cursor pagination.
 *
 * List endpoints return a stable page envelope: `data` plus `pageInfo` with an
 * opaque cursor. Cursors encode the sort key of the last item, so pages stay
 * correct while rows are inserted between requests.
 */

import { ValidationError } from './errors';

export interface PageParams {
  limit: number;
  cursor?: string;
}

export interface PageInfo {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface Page<T> {
  data: T[];
  pageInfo: PageInfo;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface ParsePageOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

function parseLimit(raw: unknown, options: ParsePageOptions): number {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  if (raw === undefined || raw === null || raw === '') return defaultLimit;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new ValidationError('Pagination limit must be a positive integer', [
      { path: 'limit', message: 'must be a positive integer' },
    ]);
  }
  if (value > maxLimit) {
    throw new ValidationError(`Pagination limit cannot exceed ${maxLimit}`, [
      { path: 'limit', message: `must be at most ${maxLimit}` },
    ]);
  }
  return value;
}

/** Read `limit`/`cursor` from a query bag, validating both. */
export function parsePageParams(query: Record<string, unknown>, options: ParsePageOptions = {}): PageParams {
  const limit = parseLimit(query.limit, options);
  const cursorRaw = query.cursor;
  if (cursorRaw === undefined || cursorRaw === null || cursorRaw === '') return { limit };

  if (typeof cursorRaw !== 'string') {
    throw new ValidationError('Cursor must be a string', [
      { path: 'cursor', message: 'must be a string' },
    ]);
  }
  return { limit, cursor: cursorRaw };
}

export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor<T = Record<string, unknown>>(cursor: string): T {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('cursor payload is not an object');
    }
    return parsed as T;
  } catch {
    throw new ValidationError('Cursor is not valid', [
      { path: 'cursor', message: 'malformed or tampered cursor' },
    ]);
  }
}

/**
 * Turn an over-fetched slice (`limit + 1` rows) into a page.
 * `getCursor` receives the last *returned* row.
 */
export function buildPage<Row, Cursor extends Record<string, unknown>>(
  rows: readonly Row[],
  params: PageParams,
  getCursor: (row: Row) => Cursor,
): Page<Row> {
  const hasMore = rows.length > params.limit;
  const data = hasMore ? rows.slice(0, params.limit) : [...rows];
  const last = data[data.length - 1];
  return {
    data,
    pageInfo: {
      limit: params.limit,
      hasMore,
      nextCursor: hasMore && last !== undefined ? encodeCursor(getCursor(last)) : null,
    },
  };
}
