import { z } from 'zod';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
  isAppError,
  toErrorResponse,
  zodIssuesToDetails,
} from './errors';

describe('error taxonomy', () => {
  it('maps each class to the expected status and code', () => {
    expect(new ValidationError()).toMatchObject({ status: 400, code: 'validation_failed' });
    expect(new UnauthorizedError()).toMatchObject({ status: 401, code: 'unauthenticated' });
    expect(new UnauthorizedError('bad password', 'invalid_credentials')).toMatchObject({
      status: 401,
      code: 'invalid_credentials',
    });
    expect(new ForbiddenError()).toMatchObject({ status: 403, code: 'forbidden' });
    expect(new NotFoundError('Shop', 'shp_1')).toMatchObject({ status: 404 });
    expect(new ConflictError('slot taken')).toMatchObject({ status: 409, code: 'conflict' });
    expect(new RateLimitError(30)).toMatchObject({ status: 429, code: 'rate_limited' });
    expect(new InternalError()).toMatchObject({ status: 500, code: 'internal_error' });
  });

  it('names subclasses after their class', () => {
    expect(new ConflictError('x').name).toBe('ConflictError');
    expect(new NotFoundError('Shop').name).toBe('NotFoundError');
  });

  it('builds a helpful not-found message with and without an id', () => {
    expect(new NotFoundError('Shop', 'shp_1').message).toBe("Shop 'shp_1' was not found");
    expect(new NotFoundError('Shop').message).toBe('Shop was not found');
  });

  it('exposes client messages only for 4xx errors', () => {
    expect(new ValidationError('bad email').expose).toBe(true);
    expect(new InternalError('db exploded', new Error('psql: relation missing')).expose).toBe(
      false,
    );
  });

  it('recognises its own errors', () => {
    expect(isAppError(new ValidationError())).toBe(true);
    expect(isAppError(new Error('plain'))).toBe(false);
  });
});

describe('zodIssuesToDetails', () => {
  it('flattens issues into dotted paths', () => {
    const schema = z.object({ profile: z.object({ email: z.string().email() }) });
    const result = schema.safeParse({ profile: { email: 'nope' } });
    expect(result.success).toBe(false);
    if (result.success) return;
    const details = zodIssuesToDetails(result.error);
    expect(details[0]).toMatchObject({ path: 'profile.email' });
    expect(details[0]!.message.length).toBeGreaterThan(0);
  });
});

describe('toErrorResponse', () => {
  it('serialises AppError with details and request id', () => {
    const error = new ValidationError('bad', [{ path: 'email', message: 'required' }]);
    const { status, body } = toErrorResponse(error, 'req_9');
    expect(status).toBe(400);
    expect(body.error).toEqual({
      code: 'validation_failed',
      message: 'bad',
      details: [{ path: 'email', message: 'required' }],
      requestId: 'req_9',
    });
  });

  it('converts uncaught ZodErrors to a 400', () => {
    const schema = z.object({ age: z.number() });
    const result = schema.safeParse({ age: 'old' });
    if (result.success) throw new Error('expected failure');
    const { status, body } = toErrorResponse(result.error);
    expect(status).toBe(400);
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.details?.[0]?.path).toBe('age');
  });

  it('hides internal failure details from clients', () => {
    const { status, body } = toErrorResponse(new Error('psql: password authentication failed'));
    expect(status).toBe(500);
    expect(body.error.code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('password authentication');
  });

  it('does not leak stack traces', () => {
    const { body } = toErrorResponse(new InternalError());
    expect(JSON.stringify(body)).not.toContain('at ');
  });

  it('omits empty details arrays', () => {
    const { body } = toErrorResponse(new ConflictError('taken'));
    expect(body.error.details).toBeUndefined();
  });

  it('keeps the original message for exposed AppErrors without a request id', () => {
    const { body } = toErrorResponse(new ForbiddenError('shop disabled'));
    expect(body.error).toEqual({ code: 'forbidden', message: 'shop disabled' });
  });

  it('treats unknown subclasses of AppError as AppError', () => {
    class PaymentDeclined extends AppError {
      constructor() {
        super(402, 'payment_declined', 'Card was declined');
      }
    }
    const { status, body } = toErrorResponse(new PaymentDeclined());
    expect(status).toBe(402);
    expect(body.error.code).toBe('payment_declined');
  });
});
