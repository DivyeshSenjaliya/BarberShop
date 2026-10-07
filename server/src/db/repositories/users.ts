import type { Role } from '../../domain/auth/rbac';
import type { Db } from '../sqlite';

/**
 * Users repository — the only place that knows the `users` table shape.
 * Domain code receives camelCase records, never raw rows.
 */

export type UserStatus = 'pending' | 'active' | 'suspended' | 'deleted';

export interface UserRecord {
  id: string;
  email: string;
  emailNormalised: string;
  phone: string | null;
  passwordHash: string;
  passwordUpdatedAt: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  locale: string;
  timezone: string;
  lastLoginAt: string | null;
  failedLoginCount: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface UserRow {
  id: string;
  email: string;
  email_normalised: string;
  phone: string | null;
  password_hash: string;
  password_updated_at: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url: string | null;
  role: Role;
  status: UserStatus;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  locale: string;
  timezone: string;
  last_login_at: string | null;
  failed_login_count: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    emailNormalised: row.email_normalised,
    phone: row.phone,
    passwordHash: row.password_hash,
    passwordUpdatedAt: row.password_updated_at,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    phoneVerifiedAt: row.phone_verified_at,
    locale: row.locale,
    timezone: row.timezone,
    lastLoginAt: row.last_login_at,
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

const SelectColumns = `
  id, email, email_normalised, phone, password_hash, password_updated_at,
  first_name, last_name, display_name, avatar_url, role, status,
  email_verified_at, phone_verified_at, locale, timezone, last_login_at,
  failed_login_count, locked_until, created_at, updated_at, deleted_at`;

export interface CreateUserInput {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role?: Role;
  locale?: string;
  timezone?: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  locale?: string;
  timezone?: string;
}

export class UsersRepository {
  constructor(private readonly db: Db) {}

  findById(id: string, options: { includeDeleted?: boolean } = {}): UserRecord | null {
    const row = this.db.get<UserRow>(
      `SELECT ${SelectColumns} FROM users WHERE id = ?${options.includeDeleted ? '' : ' AND deleted_at IS NULL'}`,
      [id],
    );
    return row ? mapRow(row) : null;
  }

  findByEmail(email: string, options: { includeDeleted?: boolean } = {}): UserRecord | null {
    const row = this.db.get<UserRow>(
      `SELECT ${SelectColumns} FROM users WHERE email_normalised = ?${options.includeDeleted ? '' : ' AND deleted_at IS NULL'}`,
      [normaliseEmail(email)],
    );
    return row ? mapRow(row) : null;
  }

  emailExists(email: string): boolean {
    return (
      this.db.get('SELECT 1 AS present FROM users WHERE email_normalised = ? AND deleted_at IS NULL', [
        normaliseEmail(email),
      ]) !== undefined
    );
  }

  phoneExists(phone: string): boolean {
    return (
      this.db.get('SELECT 1 AS present FROM users WHERE phone = ? AND deleted_at IS NULL', [phone]) !==
      undefined
    );
  }

  insert(input: CreateUserInput): UserRecord {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO users (
         id, email, email_normalised, password_hash, password_updated_at,
         first_name, last_name, display_name, role, locale, timezone, phone
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.email.trim(),
        normaliseEmail(input.email),
        input.passwordHash,
        now,
        input.firstName,
        input.lastName,
        `${input.firstName} ${input.lastName}`.trim(),
        input.role ?? 'customer',
        input.locale ?? 'en',
        input.timezone ?? 'UTC',
        input.phone ?? null,
      ],
    );
    const created = this.findById(input.id);
    if (!created) throw new Error(`user ${input.id} disappeared immediately after insert`);
    return created;
  }

  updateProfile(id: string, patch: UpdateProfileInput): UserRecord {
    const fields: string[] = [];
    const values: unknown[] = [];

    const set = (column: string, value: unknown): void => {
      fields.push(`${column} = ?`);
      values.push(value);
    };

    if (patch.firstName !== undefined) set('first_name', patch.firstName);
    if (patch.lastName !== undefined) set('last_name', patch.lastName);
    if (patch.displayName !== undefined) set('display_name', patch.displayName);
    if (patch.phone !== undefined) set('phone', patch.phone);
    if (patch.avatarUrl !== undefined) set('avatar_url', patch.avatarUrl);
    if (patch.locale !== undefined) set('locale', patch.locale);
    if (patch.timezone !== undefined) set('timezone', patch.timezone);

    // Keep the display name in step with the person's name unless the
    // caller deliberately set a custom one in the same update.
    if (
      patch.displayName === undefined &&
      (patch.firstName !== undefined || patch.lastName !== undefined)
    ) {
      const current = this.requireById(id);
      set(
        'display_name',
        `${patch.firstName ?? current.firstName} ${patch.lastName ?? current.lastName}`.trim(),
      );
    }

    if (fields.length > 0) {
      set('updated_at', new Date().toISOString());
      values.push(id);
      this.db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    return this.requireById(id);
  }

  updatePassword(id: string, passwordHash: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE users
          SET password_hash = ?, password_updated_at = ?, updated_at = ?,
              failed_login_count = 0, locked_until = NULL
        WHERE id = ?`,
      [passwordHash, now, now, id],
    );
  }

  verifyEmail(id: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?`,
      [now, now, id],
    );
  }

  setRole(id: string, role: Role): UserRecord {
    this.db.run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [
      role,
      new Date().toISOString(),
      id,
    ]);
    return this.requireById(id);
  }

  setStatus(id: string, status: UserStatus): UserRecord {
    this.db.run('UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [
      status,
      new Date().toISOString(),
      id,
    ]);
    return this.requireById(id);
  }

  recordSuccessfulLogin(id: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE users
          SET last_login_at = ?, failed_login_count = 0, locked_until = NULL, updated_at = ?
        WHERE id = ?`,
      [now, now, id],
    );
  }

  /** Returns the new consecutive failure count; locking is the service's call. */
  incrementFailedLogins(id: string): number {
    this.db.run(
      `UPDATE users SET failed_login_count = failed_login_count + 1, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), id],
    );
    const row = this.db.get<{ failed_login_count: number }>(
      'SELECT failed_login_count FROM users WHERE id = ?',
      [id],
    );
    return row?.failed_login_count ?? 0;
  }

  lockAccount(id: string, until: Date): void {
    this.db.run('UPDATE users SET locked_until = ?, updated_at = ? WHERE id = ?', [
      until.toISOString(),
      new Date().toISOString(),
      id,
    ]);
  }

  softDelete(id: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE users
          SET deleted_at = ?, status = 'deleted', updated_at = ?
        WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
  }

  requireById(id: string): UserRecord {
    const user = this.findById(id);
    if (!user) throw new Error(`user '${id}' not found`);
    return user;
  }
}
