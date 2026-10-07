import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

/**
 * Environment-driven configuration.
 *
 * Every value the server reads from the outside world is declared here once and
 * validated in one place. Nothing else in the codebase touches `process.env`
 * directly — consumers receive a frozen, typed object instead.
 */

const DevelopmentSecret = 'dev-insecure-secret-do-not-use-in-production';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_FILE: z.string().min(1).default('./data/barbershop.db'),

  AUTH_SECRET: z.string().min(32).optional(),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(30 * 24 * 60 * 60),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(10),

  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
  PAYMENT_PROVIDER: z.enum(['mock']).default('mock'),
});

export type RawEnv = z.input<typeof EnvSchema>;

export interface AppConfig {
  readonly env: 'development' | 'test' | 'production';
  readonly isProduction: boolean;
  readonly host: string;
  readonly port: number;
  readonly database: { readonly file: string };
  readonly auth: {
    readonly secret: string;
    readonly accessTokenTtlSeconds: number;
    readonly refreshTokenTtlSeconds: number;
    readonly passwordMinLength: number;
  };
  readonly cors: { readonly origins: readonly string[] };
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  readonly rateLimit: {
    readonly windowMs: number;
    readonly max: number;
    readonly authMax: number;
  };
  readonly publicBaseUrl: string;
  readonly paymentProvider: 'mock';
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Minimal `.env` parser so local development does not need an extra dependency.
 * Lines are `KEY=value`; `#` starts a comment; values may be quoted.
 * Existing process variables always win.
 */
export function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadEnvFile(path: string, target: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(path)) return;
  const parsed = parseEnvFile(readFileSync(path, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (target[key] === undefined) target[key] = value;
  }
}

function defaultLogLevel(env: 'development' | 'test' | 'production'): 'debug' | 'info' | 'warn' | 'error' {
  if (env === 'test') return 'error';
  if (env === 'production') return 'info';
  return 'debug';
}

/**
 * Build a validated config from an environment bag. Throws `ConfigError` with
 * every problem it found rather than failing on the first one.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`Invalid environment configuration: ${issues}`);
  }

  const values = parsed.data;
  const isProduction = values.NODE_ENV === 'production';

  // Production must never fall back to a baked-in secret.
  const secret = values.AUTH_SECRET ?? (isProduction ? undefined : DevelopmentSecret);
  if (!secret) {
    throw new ConfigError(
      'AUTH_SECRET is required in production and must be at least 32 characters long',
    );
  }

  if (isProduction && values.CORS_ORIGINS === '*') {
    throw new ConfigError('CORS_ORIGINS must list explicit origins in production');
  }

  const config: AppConfig = {
    env: values.NODE_ENV,
    isProduction,
    host: values.HOST,
    port: values.PORT,
    database: { file: values.DATABASE_FILE },
    auth: {
      secret,
      accessTokenTtlSeconds: values.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlSeconds: values.REFRESH_TOKEN_TTL_SECONDS,
      passwordMinLength: values.PASSWORD_MIN_LENGTH,
    },
    cors: {
      origins: values.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    },
    logLevel: values.LOG_LEVEL ?? defaultLogLevel(values.NODE_ENV),
    rateLimit: {
      windowMs: values.RATE_LIMIT_WINDOW_MS,
      max: values.RATE_LIMIT_MAX,
      authMax: values.AUTH_RATE_LIMIT_MAX,
    },
    publicBaseUrl: values.PUBLIC_BASE_URL,
    paymentProvider: values.PAYMENT_PROVIDER,
  };

  return Object.freeze(config);
}
