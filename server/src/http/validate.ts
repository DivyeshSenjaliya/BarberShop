import type { Request } from 'express';
import type { ZodType } from 'zod';
import { ValidationError, zodIssuesToDetails } from '../core/errors';

/**
 * Request validation helpers.
 *
 * Every route parses its input through zod here, so failures always come
 * back as the same 400 envelope with per-field details instead of ad-hoc
 * checks scattered across handlers.
 */

function parse<T>(schema: ZodType<T>, value: unknown, source: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new ValidationError(
    `The request ${source} could not be validated`,
    zodIssuesToDetails(result.error).map((detail) => ({
      ...detail,
      path: detail.path ? `${source}.${detail.path}` : source,
    })),
  );
}

export function parseBody<T>(schema: ZodType<T>, req: Request): T {
  return parse(schema, req.body, 'body');
}

export function parseQuery<T>(schema: ZodType<T>, req: Request): T {
  return parse(schema, req.query, 'query');
}

export function parseParams<T>(schema: ZodType<T>, req: Request): T {
  return parse(schema, req.params, 'params');
}
