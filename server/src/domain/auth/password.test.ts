import {
  DEFAULT_PARAMS,
  PasswordPolicyError,
  assertPasswordPolicy,
  checkPasswordPolicy,
  hashPassword,
  needsRehash,
  verifyPassword,
} from './password';

describe('hashPassword / verifyPassword', () => {
  it('round-trips a password', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored.startsWith('scrypt$ln=14,r=8,p=1$')).toBe(true);
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse batterY', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('salts every hash so identical passwords look different', async () => {
    const first = await hashPassword('same-password-1');
    const second = await hashPassword('same-password-1');
    expect(first).not.toBe(second);
    expect(await verifyPassword('same-password-1', first)).toBe(true);
    expect(await verifyPassword('same-password-1', second)).toBe(true);
  });

  it('normalises unicode so the same typed password matches', async () => {
    const composed = 'café-password-1'; // é as one code point
    const decomposed = 'café-password-1'; // e + combining acute
    const stored = await hashPassword(composed);
    expect(await verifyPassword(decomposed, stored)).toBe(true);
  });

  it('returns false for malformed stored values instead of throwing', async () => {
    for (const stored of ['', 'plaintext', 'scrypt$bad', 'bcrypt$ln=14$aa$bb', 'scrypt$ln=14$!!!$!!!']) {
      expect(await verifyPassword('anything', stored)).toBe(false);
    }
  });

  it('rejects absurd cost parameters in a stored hash', async () => {
    const forged = `scrypt$ln=99,r=8,p=1$c2FsdA==$aGFzaA==`;
    expect(await verifyPassword('x', forged)).toBe(false);
  });
});

describe('needsRehash', () => {
  it('flags hashes weaker than the current defaults', async () => {
    const weak = await hashPassword('some-password-1', { N: 1024, r: 8, p: 1 });
    expect(needsRehash(weak)).toBe(true);
    expect(needsRehash(weak, { N: 1024, r: 8, p: 1 })).toBe(false);
  });

  it('flags unparseable hashes', () => {
    expect(needsRehash('not-a-hash')).toBe(true);
  });

  it('accepts current default hashes', async () => {
    const stored = await hashPassword('some-password-1');
    expect(needsRehash(stored, DEFAULT_PARAMS)).toBe(false);
  });
});

describe('password policy', () => {
  it('accepts a reasonable password', () => {
    expect(checkPasswordPolicy('tr0ub4dor-and-3')).toEqual({ ok: true, problems: [] });
    expect(() => assertPasswordPolicy('tr0ub4dor-and-3')).not.toThrow();
  });

  it('rejects short passwords and says why', () => {
    const result = checkPasswordPolicy('Ab1');
    expect(result.ok).toBe(false);
    expect(result.problems).toContain('must be at least 10 characters long');
  });

  it('requires both a letter and a digit', () => {
    expect(checkPasswordPolicy('abcdefghij').problems).toContain('must contain a digit');
    expect(checkPasswordPolicy('1234567890').problems).toContain('must contain a letter');
  });

  it('rejects blocklisted and repeated-character passwords', () => {
    expect(checkPasswordPolicy('password123').ok).toBe(false);
    expect(checkPasswordPolicy('aaaaaaaaaa').problems).toContain(
      'must not be a single repeated character',
    );
  });

  it('rejects passwords that are too long (hashing DoS)', () => {
    expect(checkPasswordPolicy(`a1${'x'.repeat(400)}`).problems).toContain(
      'must be at most 200 characters long',
    );
  });

  it('honours a custom minimum length', () => {
    expect(checkPasswordPolicy('Ab1defgh', { minLength: 8 }).ok).toBe(true);
    expect(checkPasswordPolicy('Ab1defgh', { minLength: 12 }).ok).toBe(false);
  });

  it('throws PasswordPolicyError with the problem list', () => {
    try {
      assertPasswordPolicy('short');
      throw new Error('expected PasswordPolicyError');
    } catch (error) {
      expect(error).toBeInstanceOf(PasswordPolicyError);
      expect((error as PasswordPolicyError).problems.length).toBeGreaterThan(0);
    }
  });
});
