import type { Db } from '../sqlite';

/**
 * Sessions repository — owns `auth_sessions`.
 *
 * Refresh tokens are looked up by hash; the plaintext value never exists on
 * the server after it is issued. Rotation revokes the old row rather than
 * deleting it so suspicious reuse is detectable.
 */

export type RevokeReason = 'logout' | 'logout_all' | 'rotated' | 'password_change' | 'expired' | 'admin';

export interface SessionRecord {
  id: string;
  userId: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  issuedAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedReason: RevokeReason | null;
  createdAt: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  device_name: string | null;
  user_agent: string | null;
  ip_address: string | null;
  issued_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  revoked_reason: RevokeReason | null;
  created_at: string;
}

function mapRow(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    deviceName: row.device_name,
    userAgent: row.user_agent,
    ipAddress: row.ip_address,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    createdAt: row.created_at,
  };
}

const SelectColumns = `id, user_id, refresh_token_hash, device_name, user_agent, ip_address,
  issued_at, expires_at, last_used_at, revoked_at, revoked_reason, created_at`;

export interface CreateSessionInput {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  deviceName?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export class SessionsRepository {
  constructor(private readonly db: Db) {}

  create(input: CreateSessionInput): SessionRecord {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO auth_sessions (
         id, user_id, refresh_token_hash, device_name, user_agent, ip_address,
         issued_at, expires_at, last_used_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.refreshTokenHash,
        input.deviceName ?? null,
        input.userAgent ?? null,
        input.ipAddress ?? null,
        now,
        input.expiresAt,
        now,
      ],
    );
    const created = this.findById(input.id);
    if (!created) throw new Error(`session ${input.id} disappeared immediately after insert`);
    return created;
  }

  findByRefreshTokenHash(hash: string): SessionRecord | null {
    const row = this.db.get<SessionRow>(
      `SELECT ${SelectColumns} FROM auth_sessions WHERE refresh_token_hash = ?`,
      [hash],
    );
    return row ? mapRow(row) : null;
  }

  findById(id: string): SessionRecord | null {
    const row = this.db.get<SessionRow>(
      `SELECT ${SelectColumns} FROM auth_sessions WHERE id = ?`,
      [id],
    );
    return row ? mapRow(row) : null;
  }

  listForUser(userId: string, options: { activeOnly?: boolean } = {}): SessionRecord[] {
    const where = options.activeOnly
      ? 'user_id = ? AND revoked_at IS NULL AND expires_at > ?'
      : 'user_id = ?';
    const params = options.activeOnly ? [userId, new Date().toISOString()] : [userId];
    return this.db
      .all<SessionRow>(
        `SELECT ${SelectColumns} FROM auth_sessions WHERE ${where} ORDER BY issued_at DESC, id DESC`,
        params,
      )
      .map(mapRow);
  }

  revoke(id: string, reason: RevokeReason): boolean {
    const result = this.db.run(
      `UPDATE auth_sessions
          SET revoked_at = ?, revoked_reason = ?
        WHERE id = ? AND revoked_at IS NULL`,
      [new Date().toISOString(), reason, id],
    );
    return result.changes > 0;
  }

  revokeAllForUser(userId: string, reason: RevokeReason, exceptSessionId?: string): number {
    const result = this.db.run(
      `UPDATE auth_sessions
          SET revoked_at = ?, revoked_reason = ?
        WHERE user_id = ? AND revoked_at IS NULL AND id <> ?`,
      [new Date().toISOString(), reason, userId, exceptSessionId ?? ''],
    );
    return result.changes;
  }

  touch(id: string): void {
    this.db.run('UPDATE auth_sessions SET last_used_at = ? WHERE id = ?', [
      new Date().toISOString(),
      id,
    ]);
  }

  /** Housekeeping: drop sessions that expired more than `graceDays` ago. */
  deleteExpired(graceDays = 7): number {
    const cutoff = new Date(Date.now() - graceDays * 86_400_000).toISOString();
    const result = this.db.run('DELETE FROM auth_sessions WHERE expires_at < ?', [cutoff]);
    return result.changes;
  }
}
