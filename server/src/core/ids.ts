/**
 * Identifier generation.
 *
 * Every entity gets a prefixed, lexicographically sortable id:
 * `bk_01K5Z3Q7F9W2YB6H4N8T1C0X5D`. The payload is a ULID (48-bit timestamp +
 * 80 bits of randomness, Crockford base32), so ids sort by creation time,
 * are URL-safe, and never reveal sequential counts of business data.
 */

const Crockford = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TimeLength = 10;
const RandomLength = 16;

export const ID_PREFIXES = [
  'usr',
  'addr',
  'shop',
  'brch',
  'cat',
  'srv',
  'staff',
  'sched',
  'bkd',
  'pay',
  'inv',
  'rfnd',
  'coup',
  'lnr',
  'rev',
  'rpt',
  'fav',
  'ntf',
  'wal',
  'txn',
  'ses',
  'req',
  'tkt',
  'img',
  'rdm',
  'lyt',
  'ltx',
  'prf',
  'aud',
  'idk',
  'obx',
  'lve',
] as const;

export type IdPrefix = (typeof ID_PREFIXES)[number];

function encodeTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new Error(`cannot encode timestamp: ${timestamp}`);
  }
  let remaining = Math.floor(timestamp);
  let out = '';
  for (let index = 0; index < TimeLength; index += 1) {
    out = Crockford[remaining % 32] + out;
    remaining = Math.floor(remaining / 32);
  }
  return out;
}

function randomChars(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let index = 0; index < length; index += 1) {
    out += Crockford[bytes[index]! % 32];
  }
  return out;
}

let lastTime = -1;
let lastRandom = '';

/**
 * Generate a ULID. Ids created within the same millisecond are strictly
 * increasing so bulk inserts keep a stable order.
 */
export function ulid(now: number = Date.now()): string {
  if (now === lastTime) {
    lastRandom = incrementBase32(lastRandom);
  } else {
    lastTime = now;
    lastRandom = randomChars(RandomLength);
  }
  return encodeTime(now) + lastRandom;
}

function incrementBase32(value: string): string {
  const chars = [...value];
  for (let index = chars.length - 1; index >= 0; index -= 1) {
    const position = Crockford.indexOf(chars[index]!);
    if (position < 31) {
      chars[index] = Crockford[position + 1]!;
      return chars.join('');
    }
    chars[index] = Crockford[0]!;
  }
  // Overflow after 2^80 ids in one millisecond is not a realistic concern,
  // but falling back to fresh randomness keeps the invariant intact.
  return randomChars(RandomLength);
}

export function newId(prefix: IdPrefix, now?: number): string {
  return `${prefix}_${ulid(now).toLowerCase()}`;
}

const IdPattern = /^([a-z]{3,5})_([0-9a-hjkmnp-tv-z]{26})$/;

export function isId(value: unknown, prefix?: IdPrefix): value is string {
  if (typeof value !== 'string') return false;
  const match = IdPattern.exec(value);
  if (!match) return false;
  return prefix === undefined || match[1] === prefix;
}

/** Extract the timestamp encoded in a ULID-bearing id. */
export function idTimestamp(value: string): number | null {
  const match = IdPattern.exec(value);
  if (!match) return null;
  const body = match[2]!.slice(0, TimeLength);
  let time = 0;
  for (const char of body) {
    const position = Crockford.indexOf(char.toUpperCase());
    if (position === -1) return null;
    time = time * 32 + position;
  }
  return time;
}
