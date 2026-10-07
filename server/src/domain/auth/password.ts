import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing.
 *
 * Uses scrypt from Node's crypto module (memory-hard, no native
 * dependency). Parameters live inside the stored string so they can be
 * raised later without invalidating existing passwords:
 *
 *   scrypt$ln=14,r=8,p=1$<salt base64>$<hash base64>
 */

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export interface ScryptParams {
  /** CPU/memory cost — a power of two. */
  N: number;
  /** Block size. */
  r: number;
  /** Parallelisation. */
  p: number;
}

export const DEFAULT_PARAMS: ScryptParams = { N: 16384, r: 8, p: 1 };
export const KEY_LENGTH = 64;
export const SALT_LENGTH = 16;

export class PasswordPolicyError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Password does not meet policy: ${problems.join(', ')}`);
    this.name = 'PasswordPolicyError';
    this.problems = problems;
  }
}

export interface PasswordPolicy {
  minLength: number;
}

/**
 * Small, deliberately local blocklist: the worst offenders that defeat a
 * length requirement. A real deployment would back this with a breached
 * password corpus; keeping it inline keeps the rule auditable.
 */
const COMMON_PASSWORDS = new Set([
  'password12',
  'password123',
  '1234567890',
  'qwertyuiop',
  'iloveyou12',
  'letmein123',
  'welcome123',
  'barbershop1',
  'admin12345',
]);

export interface PolicyResult {
  ok: boolean;
  problems: string[];
}

/** Pure check used by both registration and settings screens. */
export function checkPasswordPolicy(
  password: string,
  policy: PasswordPolicy = { minLength: 10 },
): PolicyResult {
  const problems: string[] = [];
  if (password.length < policy.minLength) {
    problems.push(`must be at least ${policy.minLength} characters long`);
  }
  if (password.length > 200) {
    problems.push('must be at most 200 characters long');
  }
  if (!/[A-Za-z]/.test(password)) problems.push('must contain a letter');
  if (!/[0-9]/.test(password)) problems.push('must contain a digit');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    problems.push('is too common, choose something less guessable');
  }
  if (/^(.)\1+$/.test(password)) problems.push('must not be a single repeated character');
  return { ok: problems.length === 0, problems };
}

export function assertPasswordPolicy(
  password: string,
  policy: PasswordPolicy = { minLength: 10 },
): void {
  const result = checkPasswordPolicy(password, policy);
  if (!result.ok) throw new PasswordPolicyError(result.problems);
}

function maxmemFor(params: ScryptParams): number {
  // Node's default maxmem (32MB) is too small once N grows; give scrypt
  // the headroom its parameters imply plus slack.
  return Math.max(64 * 1024 * 1024, 256 * params.N * params.r);
}

export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_PARAMS,
): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    ...params,
    maxmem: maxmemFor(params),
  });
  const cost = Math.log2(params.N);
  return [
    'scrypt',
    `ln=${cost},r=${params.r},p=${params.p}`,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

interface ParsedHash {
  params: ScryptParams;
  salt: Buffer;
  hash: Buffer;
}

function parseStored(stored: string): ParsedHash | null {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return null;

  const paramBag: Record<string, number> = {};
  for (const pair of (parts[1] ?? '').split(',')) {
    const [key, value] = pair.split('=');
    if (!key || value === undefined || !/^\d+$/.test(value)) return null;
    paramBag[key] = Number(value);
  }
  const { ln, r, p } = paramBag;
  if (ln === undefined || r === undefined || p === undefined) return null;
  if (ln < 10 || ln > 20 || r < 1 || r > 32 || p < 1 || p > 16) return null;

  try {
    const salt = Buffer.from(parts[2]!, 'base64');
    const hash = Buffer.from(parts[3]!, 'base64');
    if (salt.length === 0 || hash.length === 0) return null;
    return { params: { N: 2 ** ln, r, p }, salt, hash };
  } catch {
    return null;
  }
}

/**
 * Verify a password against a stored hash. Returns `false` (never throws)
 * for malformed or unknown-format stored values so a corrupt row cannot
 * turn into a 500 during login.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStored(stored);
  if (!parsed) return false;

  const derived = await scrypt(password.normalize('NFKC'), parsed.salt, parsed.hash.length, {
    ...parsed.params,
    maxmem: maxmemFor(parsed.params),
  });
  return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
}

/** True when the stored hash uses weaker parameters than the current default. */
export function needsRehash(stored: string, params: ScryptParams = DEFAULT_PARAMS): boolean {
  const parsed = parseStored(stored);
  if (!parsed) return true;
  return (
    parsed.params.N < params.N ||
    parsed.params.r < params.r ||
    parsed.params.p < params.p ||
    parsed.hash.length < KEY_LENGTH
  );
}
