import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../core/config';
import type { Logger } from '../../core/logger';
import type { Db } from '../../db/sqlite';
import type { AuthService, SessionContext } from '../../domain/auth/service';
import { asyncHandler } from '../asyncHandler';
import { authenticate, currentPrincipal, requireAuth } from '../middleware/auth';
import { rateLimit } from '../rateLimit';
import { sendCreated, sendNoContent, sendOk } from '../responses';
import { parseBody } from '../validate';

export interface AuthRouterDeps {
  db: Db;
  config: AppConfig;
  logger: Logger;
  auth: AuthService;
}

const EmailSchema = z.string().trim().min(3).max(254).email('Enter a valid email address');
const PasswordSchema = z.string().min(1, 'Password is required').max(200);
const NameSchema = z.string().trim().min(1, 'Required').max(60);
const DeviceSchema = z.string().trim().max(80).nullish();

const RegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  firstName: NameSchema,
  lastName: NameSchema,
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{6,18}$/, 'Enter a valid phone number')
    .nullish(),
  locale: z.string().trim().min(2).max(10).optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
  deviceName: DeviceSchema,
});

const LoginSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  deviceName: DeviceSchema,
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required').max(512),
});

const LogoutSchema = RefreshSchema;

function contextFrom(req: Request, deviceName?: string | null): SessionContext {
  return {
    deviceName: deviceName ?? null,
    userAgent: req.header('user-agent') ?? null,
    ipAddress: req.ip ?? null,
  };
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const { auth, config } = deps;

  // Brute-force protection scoped to auth endpoints, keyed per IP so one
  // noisy client cannot exhaust the global budget for everyone.
  const authLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.authMax,
    keyFor: (req) => `auth:${req.ip}`,
  });

  router.post(
    '/register',
    authLimiter,
    asyncHandler(async (req, res) => {
      const body = parseBody(RegisterSchema, req);
      const result = await auth.register({
        email: body.email,
        password: body.password,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone ?? null,
        ...(body.locale ? { locale: body.locale } : {}),
        ...(body.timezone ? { timezone: body.timezone } : {}),
        ...contextFrom(req, body.deviceName),
      });
      sendCreated(res, result, `/api/v1/auth/me`);
    }),
  );

  router.post(
    '/login',
    authLimiter,
    asyncHandler(async (req, res) => {
      const body = parseBody(LoginSchema, req);
      const result = await auth.login({
        email: body.email,
        password: body.password,
        ...contextFrom(req, body.deviceName),
      });
      sendOk(res, result);
    }),
  );

  router.post(
    '/refresh',
    authLimiter,
    asyncHandler((req, res) => {
      const body = parseBody(RefreshSchema, req);
      sendOk(res, auth.refresh(body.refreshToken, contextFrom(req)));
    }),
  );

  router.post(
    '/logout',
    asyncHandler((req, res) => {
      const body = parseBody(LogoutSchema, req);
      auth.logout(body.refreshToken);
      sendNoContent(res);
    }),
  );

  // Everything below requires a valid access token.
  router.use(authenticate({ db: deps.db, config: deps.config }));

  router.get(
    '/me',
    requireAuth(),
    asyncHandler((req, res) => {
      const principal = currentPrincipal(res);
      sendOk(res, { user: auth.getProfile(principal.userId) });
    }),
  );

  router.get(
    '/sessions',
    requireAuth(),
    asyncHandler((req, res) => {
      const principal = currentPrincipal(res);
      sendOk(res, { sessions: auth.listSessions(principal.userId) });
    }),
  );

  router.post(
    '/logout-all',
    requireAuth(),
    asyncHandler((req, res) => {
      const principal = currentPrincipal(res);
      sendOk(res, { revoked: auth.logoutAll(principal.userId) });
    }),
  );

  return router;
}
