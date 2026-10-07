import { ID_PREFIXES, idTimestamp, isId, newId, ulid } from './ids';

describe('newId', () => {
  it('produces prefixed, lowercase, fixed-length ids', () => {
    const id = newId('bkd');
    expect(id).toMatch(/^bkd_[0-9a-hjkmnp-tv-z]{26}$/);
    expect(isId(id, 'bkd')).toBe(true);
  });

  it('never collides across a burst of generations', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId('usr')));
    expect(ids.size).toBe(5000);
  });

  it('sorts strictly increasing within the same millisecond', () => {
    const now = 1_780_000_000_000;
    const ids = Array.from({ length: 50 }, () => ulid(now));
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('encodes the creation timestamp', () => {
    const now = 1_780_000_000_123;
    expect(idTimestamp(`bkd_${ulid(now).toLowerCase()}`)).toBe(now);
    expect(idTimestamp('bkd_notavalidulid')).toBeNull();
    expect(idTimestamp('garbage')).toBeNull();
  });

  it('validates prefix and shape', () => {
    const id = newId('srv');
    expect(isId(id)).toBe(true);
    expect(isId(id, 'srv')).toBe(true);
    expect(isId(id, 'shop')).toBe(false);
    expect(isId('srv_TOOSHORT')).toBe(false);
    expect(isId(42)).toBe(false);
    expect(isId('SRV_01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe(false); // uppercase payload
  });

  it('exposes only lowercase short prefixes', () => {
    expect(new Set(ID_PREFIXES).size).toBe(ID_PREFIXES.length);
    for (const prefix of ID_PREFIXES) expect(prefix).toMatch(/^[a-z]{3,5}$/);
  });
});
