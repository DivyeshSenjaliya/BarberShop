import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { UsersRepository, normaliseEmail } from './users';

describe('UsersRepository', () => {
  let db: Db;
  let users: UsersRepository;

  beforeEach(() => {
    db = createTestDb();
    users = new UsersRepository(db);
  });

  afterEach(() => db.close());

  function insertUser(overrides: Partial<Parameters<UsersRepository['insert']>[0]> = {}) {
    return users.insert({
      id: newId('usr'),
      email: 'Kim.Lee@Example.com',
      passwordHash: 'scrypt$ln=14,r=8,p=1$c2FsdA==$aGFzaA==',
      firstName: 'Kim',
      lastName: 'Lee',
      ...overrides,
    });
  }

  it('inserts and reads back a mapped record', () => {
    const created = insertUser();
    expect(created.emailNormalised).toBe('kim.lee@example.com');
    expect(created.displayName).toBe('Kim Lee');
    expect(created.role).toBe('customer');
    expect(created.status).toBe('active');
    expect(created.failedLoginCount).toBe(0);
    expect(created.lockedUntil).toBeNull();
    expect(created.deletedAt).toBeNull();

    expect(users.findById(created.id)).toEqual(created);
  });

  it('finds by email case- and whitespace-insensitively', () => {
    insertUser();
    expect(users.findByEmail('  KIM.LEE@EXAMPLE.COM ')).not.toBeNull();
    expect(users.findByEmail('other@example.com')).toBeNull();
  });

  it('treats soft-deleted users as gone by default', () => {
    const created = insertUser();
    users.softDelete(created.id);
    expect(users.findById(created.id)).toBeNull();
    expect(users.findByEmail(created.email)).toBeNull();
    expect(users.findById(created.id, { includeDeleted: true })?.deletedAt).not.toBeNull();
    expect(users.findById(created.id, { includeDeleted: true })?.status).toBe('deleted');
    expect(users.emailExists(created.email)).toBe(false);
  });

  it('frees the email for re-registration after soft delete', () => {
    const created = insertUser();
    users.softDelete(created.id);
    expect(() => insertUser({ phone: null })).not.toThrow();
  });

  it('rejects duplicate emails at the database level', () => {
    insertUser();
    expect(() => insertUser()).toThrow(/UNIQUE/i);
  });

  it('reports email and phone availability', () => {
    insertUser({ phone: '+15550001111' });
    expect(users.emailExists('kim.lee@example.com')).toBe(true);
    expect(users.emailExists('new@example.com')).toBe(false);
    expect(users.phoneExists('+15550001111')).toBe(true);
    expect(users.phoneExists('+15550002222')).toBe(false);
  });

  it('updates only the provided profile fields', () => {
    const created = insertUser();
    const updated = users.updateProfile(created.id, { firstName: 'Katherine', locale: 'fr' });

    expect(updated.firstName).toBe('Katherine');
    expect(updated.displayName).toBe('Katherine Lee');
    expect(updated.locale).toBe('fr');
    expect(updated.lastName).toBe(created.lastName);
    expect(updated.email).toBe(created.email);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it('recomputes display name when first or last name changes', () => {
    const created = insertUser();
    expect(users.updateProfile(created.id, { lastName: 'Kim' }).displayName).toBe('Kim Kim');
    expect(users.updateProfile(created.id, { displayName: 'K' }).displayName).toBe('K');
  });

  it('returns the record when no fields change', () => {
    const created = insertUser();
    expect(users.updateProfile(created.id, {})).toEqual(created);
  });

  it('replaces the password and clears lock state', async () => {
    const created = insertUser();
    users.lockAccount(created.id, new Date('2030-01-01T00:00:00Z'));
    users.updatePassword(created.id, 'scrypt$ln=14,r=8,p=1$c2FsdA==$bmV3');

    const reloaded = users.findById(created.id)!;
    expect(reloaded.passwordHash).toBe('scrypt$ln=14,r=8,p=1$c2FsdA==$bmV3');
    expect(reloaded.failedLoginCount).toBe(0);
    expect(reloaded.lockedUntil).toBeNull();
  });

  it('tracks login attempts', () => {
    const created = insertUser();
    expect(users.incrementFailedLogins(created.id)).toBe(1);
    expect(users.incrementFailedLogins(created.id)).toBe(2);
    expect(users.findById(created.id)!.failedLoginCount).toBe(2);

    users.lockAccount(created.id, new Date('2030-01-01T00:00:00Z'));
    expect(users.findById(created.id)!.lockedUntil).toBe('2030-01-01T00:00:00.000Z');

    users.recordSuccessfulLogin(created.id);
    const afterLogin = users.findById(created.id)!;
    expect(afterLogin.failedLoginCount).toBe(0);
    expect(afterLogin.lockedUntil).toBeNull();
    expect(afterLogin.lastLoginAt).not.toBeNull();
  });

  it('promotes roles and manages status and verification', () => {
    const created = insertUser();
    expect(users.setRole(created.id, 'barber').role).toBe('barber');
    expect(users.setStatus(created.id, 'suspended').status).toBe('suspended');

    users.verifyEmail(created.id);
    const verified = users.findById(created.id)!;
    expect(verified.emailVerifiedAt).not.toBeNull();

    users.verifyEmail(created.id);
    expect(users.findById(created.id)!.emailVerifiedAt).toBe(verified.emailVerifiedAt);
  });

  it('throws a helpful error when requiring a missing user', () => {
    expect(() => users.requireById('usr_missing')).toThrow(/not found/);
  });

  it('normalises emails consistently', () => {
    expect(normaliseEmail('  Kim@Example.COM ')).toBe('kim@example.com');
  });
});
