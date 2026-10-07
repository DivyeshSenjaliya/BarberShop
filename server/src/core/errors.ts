import { ZodError } from 'zod';

/**
 * Error taxonomy.
 *
 * Every failure that leaves the API is an `AppError` with a stable machine
 * readable `code`, an HTTP status and (optionally) field-level details.
 * Stack traces and driver messages never cross the boundary.
 */

export interface ErrorDetail {
  /** Dotted path of the offending field, e.g. `profile.email`. */
  path: string;
  message: string;
  code?: string;
}

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
    requestId?: string;
  };
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];
  /** `false` hides the message from clients (used for internal failures). */
  readonly expose: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: ErrorDetail[]; cause?: unknown; expose?: boolean } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? status < 500;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The request could not be validated', details: ErrorDetail[] = []) {
    super(400, 'validation_failed', message, { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required', code = 'unauthenticated') {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, 'forbidden', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, 'not_found', id ? `${resource} '${id}' was not found` : `${resource} was not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(409, 'conflict', message, details ? { details } : {});
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super(429, 'rate_limited', 'Too many requests, please slow down', {
      details: [{ path: 'retryAfter', message: String(retryAfterSeconds) }],
    });
  }
}

export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred', cause?: unknown) {
    super(500, 'internal_error', message, { cause, expose: false });
  }
}

export function zodIssuesToDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/** Convert any thrown value into the wire representation. */
export function toErrorResponse(
  error: unknown,
  requestId?: string,
): { status: number; body: ErrorResponseBody } {
  if (error instanceof AppError) {
    const body: ErrorResponseBody['error'] = {
      code: error.code,
      message: error.expose ? error.message : 'An unexpected error occurred',
    };
    if (error.details && error.details.length > 0) body.details = error.details;
    if (requestId) body.requestId = requestId;
    return { status: error.status, body: { error: body } };
  }

  if (error instanceof ZodError) {
    const body: ErrorResponseBody['error'] = {
      code: 'validation_failed',
      message: 'The request could not be validated',
      details: zodIssuesToDetails(error),
    };
    if (requestId) body.requestId = requestId;
    return { status: 400, body: { error: body } };
  }

  const body: ErrorResponseBody['error'] = {
    code: 'internal_error',
    message: 'An unexpected error occurred',
  };
  if (requestId) body.requestId = requestId;
  return { status: 500, body: { error: body } };
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
