import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from '../core/logger';
import { newId } from '../core/ids';
import { AppError, ValidationError, toErrorResponse } from '../core/errors';
import './context';

const RequestIdPattern = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Assigns a correlation id to the request (honouring a client-supplied
 * `X-Request-Id`) and binds a child logger to it.
 */
export function requestContext(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header('x-request-id');
    const requestId =
      incoming && RequestIdPattern.test(incoming) ? incoming : newId('req');

    req.id = requestId;
    req.startedAt = Date.now();
    req.log = logger.child({
      requestId,
      method: req.method,
      path: req.path,
    });
    res.setHeader('X-Request-Id', requestId);
    next();
  };
}

/** One structured line per finished request. Never logs bodies. */
export function accessLog(): RequestHandler {
  return (req, res, next) => {
    res.on('finish', () => {
      const durationMs = Date.now() - req.startedAt;
      const fields = {
        status: res.statusCode,
        durationMs,
        ip: req.ip,
        userId: res.locals.userId,
      };
      if (res.statusCode >= 500) req.log.error('http.request', fields);
      else if (res.statusCode >= 400) req.log.warn('http.request', fields);
      else req.log.info('http.request', fields);
    });
    next();
  };
}

export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(
      new AppError(404, 'route_not_found', `No route matches ${req.method} ${req.path}`),
    );
  };
}

/**
 * Terminal error middleware: convert anything thrown into the standard error
 * envelope, log internal failures with their stack, and make sure clients
 * never see either.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const normalised = normaliseBodyParserError(error);
    const requestId = req.id;
    const { status, body } = toErrorResponse(normalised, requestId);

    if (status >= 500) {
      (req.log ?? logger).error('http.error', {
        status,
        code: body.error.code,
        error: normalised instanceof Error ? normalised : new Error(String(normalised)),
      });
    } else {
      (req.log ?? logger).warn('http.client_error', {
        status,
        code: body.error.code,
        message: body.error.message,
      });
    }

    res.status(status).json(body);
  };
}

/** Malformed or oversized bodies are client errors, not server crashes. */
function normaliseBodyParserError(error: unknown): unknown {
  const candidate = error as { type?: string; status?: number; statusCode?: number } | null;
  if (!candidate || typeof candidate !== 'object') return error;

  if (candidate.type === 'entity.parse.failed') {
    return new ValidationError('Request body is not valid JSON', [
      { path: 'body', message: 'malformed JSON payload' },
    ]);
  }
  if (candidate.status === 413 || candidate.statusCode === 413) {
    return new AppError(413, 'payload_too_large', 'Request body is too large');
  }
  return error;
}
