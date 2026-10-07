import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import type { AppConfig } from '../core/config';
import type { Logger } from '../core/logger';
import type { Db } from '../db/sqlite';
import { AuthService } from '../domain/auth/service';
import { CatalogService } from '../domain/catalog/service';
import { asyncHandler } from './asyncHandler';
import {
  accessLog,
  errorHandler,
  notFoundHandler,
  requestContext,
} from './middleware';
import { rateLimit } from './rateLimit';
import { sendOk } from './responses';
import { createApiRouter } from './routes';
import './context';

export interface AppDeps {
  config: AppConfig;
  logger: Logger;
  db: Db;
}

export interface CreateAppOptions {
  /** Override the JSON body limit (used by tests). */
  jsonLimit?: string;
  /** Provide a clock for deterministic rate-limit tests. */
  now?: () => number;
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const VERSION = readVersion();

function corsOptions(config: AppConfig): cors.CorsOptions {
  if (config.cors.origins.includes('*')) return { origin: true };
  return {
    origin: (origin, callback) => {
      // Non-browser clients (no Origin header) are allowed; browsers must
      // match the allow-list. A mismatch simply omits the CORS headers
      // rather than failing the request with a 500.
      if (!origin || config.cors.origins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  };
}

/**
 * Application factory. Wires the cross-cutting middleware in a fixed order
 * (context → logging → parsing → limits → routes → 404 → errors) so every
 * route inherits request ids, access logs and the standard error envelope.
 */
export function createApp(deps: AppDeps, options: CreateAppOptions = {}): Express {
  const { config, logger, db } = deps;
  const app = express();

  app.disable('x-powered-by');
  // We sit behind a reverse proxy in production; trust the first hop so
  // `req.ip` (used by rate limiting) reflects the real client.
  app.set('trust proxy', 'loopback');

  app.use(cors(corsOptions(config)));
  app.use(requestContext(logger));
  app.use(accessLog());
  app.use(
    express.json({
      limit: options.jsonLimit ?? '1mb',
      type: ['application/json', 'application/*+json'],
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    skip: (req) => req.path === '/healthz',
    ...(options.now ? { now: options.now } : {}),
  });
  app.use(limiter);

  registerRoutes(app, deps);

  app.use(notFoundHandler());
  app.use(errorHandler(logger));
  return app;
}

function registerRoutes(app: Express, deps: AppDeps): void {
  const { db, config, logger } = deps;
  const auth = new AuthService({ db, config, logger });
  const catalog = new CatalogService({ db, logger });

  app.get(
    '/healthz',
    asyncHandler((req, res) => {
      let database: 'ok' | 'error' = 'ok';
      try {
        db.get('SELECT 1 AS ok');
      } catch {
        database = 'error';
      }
      sendOk(res, {
        status: database === 'ok' ? 'ok' : 'degraded',
        version: VERSION,
        environment: config.env,
        database,
        uptimeSeconds: Math.round(process.uptime()),
        requestId: req.id,
      });
    }),
  );

  app.use('/api/v1', createApiRouter({ db, config, logger, auth, catalog }));
}
