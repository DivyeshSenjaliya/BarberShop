import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { SessionsRepository, type CreateSessionInput } from './sessions';
import { UsersRepository } from './users';

describe('SessionsRepository', () => {
  let db: Db;
  let sessions: SessionsRepository;
  let userId: string;

  beforeEach(() => {
    db = createTestDb();
    sessions = new SessionsRepository(db);
    userId = new UsersRepository(db).insert({
      id: newId('usr'),
      email: 'kim@example.com',
      passwordHash: 'scrypt$ln=14,r=8,p=1$c2FsdA==$aGFzaA==',
      firstName: 'Kim',
      lastName: 'Lee',
    }).id;
  });

  afterEach(() => db.close());

  function createSession(overrides: Partial<CreateSessionInput> = {}) {
    return sessions.create({
      id: newId('ses'),
      userId,
      refreshTokenHash: `hash_${Math.random().toString(36).slice(2)}`,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      ...overrides,
    });
  }

  it('creates and looks up a session by refresh token hash', () => {
    const session = createSession({ deviceName: 'iPhone' });
    expect(session.userId).toBe(userId);
    expect(session.deviceName).toBe('iPhone');
    expect(session.revokedAt).toBeNull();

    const found = sessions.findByRefreshTokenHash(
      db.get<{ refresh_token_hash: string }>('SELECT refresh_token_hash FROM auth_sessions WHERE id = ?', [
        session.id,
      ])!.refresh_token_hash,
    );
    expect(found?.id).toBe(session.id);
    expect(sessions.findByRefreshTokenHash('no-such-hash')).toBeNull();
  });

  it('replies with null for an unknown session id', () => {
    expect(sessions.findById('ses_missing')).toBeNull();
  });

  it('revoke is idempotent and records the reason', () => {
    const session = createSession();
    expect(sessions.revoke(session.id, 'logout')).toBe(true);
    expect(sessions.revoke(session.id, 'logout_all')).toBe(false);

    const revoked = sessions.findById(session.id)!;
    expect(revoked.revokedReason).toBe('logout');
    expect(revoked.revokedAt).not.toBeNull();
  });

  it('revokes every session for a user except one', () => {
    const keep = createSession();
    createSession();
    createSession();

    expect(sessions.revokeAllForUser(userId, 'password_change', keep.id)).toBe(2);
    const active = sessions.listForUser(userId, { activeOnly: true });
    expect(active.map((session) => session.id)).toEqual([keep.id]);
  });

  it('lists sessions newest first and can include revoked ones', () => {
    const first = createSession();
    const second = createSession();
    sessions.revoke(second.id, 'logout');

    expect(sessions.listForUser(userId).map((session) => session.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(sessions.listForUser(userId, { activeOnly: true }).map((session) => session.id)).toEqual([
      first.id,
    ]);
  });

  it('hides expired sessions from the active list', () => {
    createSession({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(sessions.listForUser(userId, { activeOnly: true })).toHaveLength(0);
  });

  it('touch updates last used', () => {
    const session = createSession();
    const before = sessions.findById(session.id)!.lastUsedAt;
    db.run('UPDATE auth_sessions SET last_used_at = ? WHERE id = ?', [
      '2020-01-01T00:00:00.000Z',
      session.id,
    ]);
    sessions.touch(session.id);
    const after = sessions.findById(session.id)!.lastUsedAt!;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before ?? after).getTime());
    expect(after).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('deletes long-expired sessions', () => {
    createSession({ expiresAt: new Date(Date.now() - 30 * 86_400_000).toISOString() });
    const active = createSession();

    expect(sessions.deleteExpired(7)).toBe(1);
    expect(sessions.findById(active.id)).not.toBeNull();
    expect(db.all('SELECT id FROM auth_sessions')).toHaveLength(1);
  });
});
