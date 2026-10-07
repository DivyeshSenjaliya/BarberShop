import { ForbiddenError } from '../../core/errors';
import {
  PERMISSIONS,
  ROLES,
  assertCan,
  assertCanAny,
  can,
  canAny,
  isRole,
  permissionsFor,
  type Permission,
  type Role,
} from './rbac';

describe('roles', () => {
  it('recognises known roles only', () => {
    expect(isRole('customer')).toBe(true);
    expect(isRole('admin')).toBe(true);
    expect(isRole('superuser')).toBe(false);
    expect(isRole(42)).toBe(false);
    expect(isRole(null)).toBe(false);
  });

  it('grants strictly more permissions as the role rises', () => {
    const sizes = ROLES.map((role) => permissionsFor(role).size);
    for (let index = 1; index < sizes.length; index += 1) {
      expect(sizes[index]!).toBeGreaterThan(sizes[index - 1]!);
    }
  });

  it('makes each role a superset of the one below it', () => {
    for (let index = 1; index < ROLES.length; index += 1) {
      const lower = permissionsFor(ROLES[index - 1]!);
      const higher = permissionsFor(ROLES[index]!);
      for (const permission of lower) {
        expect(higher.has(permission)).toBe(true);
      }
    }
  });

  it('grants admin every declared permission (no orphan permissions)', () => {
    const admin = permissionsFor('admin');
    for (const permission of PERMISSIONS) {
      expect(admin.has(permission)).toBe(true);
    }
  });
});

describe('customer role', () => {
  const role: Role = 'customer';

  it('can manage its own profile, bookings and reviews', () => {
    for (const permission of [
      'profile:write',
      'address:manage',
      'appointment:book',
      'appointment:cancel:own',
      'review:create',
      'favorite:manage',
      'wallet:read',
    ] as Permission[]) {
      expect(can(role, permission)).toBe(true);
    }
  });

  it('cannot touch shop operations or see other people’s bookings', () => {
    for (const permission of [
      'appointment:read:shop',
      'staff:manage',
      'service:manage',
      'analytics:read:shop',
      'refund:process',
      'user:manage',
    ] as Permission[]) {
      expect(can(role, permission)).toBe(false);
    }
  });
});

describe('barber role', () => {
  it('reads its own schedule and assigned appointments but cannot administer', () => {
    expect(can('barber', 'schedule:read:own')).toBe(true);
    expect(can('barber', 'appointment:write:assigned')).toBe(true);
    expect(can('barber', 'earnings:read:own')).toBe(true);
    expect(can('barber', 'staff:manage')).toBe(false);
    expect(can('barber', 'appointment:write:shop')).toBe(false);
    expect(can('barber', 'refund:process')).toBe(false);
  });
});

describe('manager vs owner', () => {
  it('manager runs the shop but cannot rewrite the shop record', () => {
    expect(can('manager', 'appointment:write:shop')).toBe(true);
    expect(can('manager', 'staff:manage')).toBe(true);
    expect(can('manager', 'refund:process')).toBe(true);
    expect(can('manager', 'shop:write')).toBe(false);
    expect(can('manager', 'staff:commission:manage')).toBe(false);
  });

  it('owner can rewrite the shop and commissions', () => {
    expect(can('owner', 'shop:write')).toBe(true);
    expect(can('owner', 'staff:commission:manage')).toBe(true);
    expect(can('owner', 'user:manage')).toBe(false);
  });
});

describe('admin role', () => {
  it('can perform platform-level actions', () => {
    expect(can('admin', 'user:manage')).toBe(true);
    expect(can('admin', 'shop:approve')).toBe(true);
    expect(can('admin', 'audit:read')).toBe(true);
  });
});

describe('assertCan', () => {
  it('passes silently when allowed', () => {
    expect(() => assertCan('owner', 'shop:write')).not.toThrow();
  });

  it('throws ForbiddenError naming the role and permission', () => {
    try {
      assertCan('customer', 'staff:manage');
      throw new Error('expected ForbiddenError');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      const message = (error as ForbiddenError).message;
      expect(message).toContain('customer');
      expect(message).toContain('staff:manage');
    }
  });

  it('assertCanAny passes when any permission matches', () => {
    expect(assertCanAny('barber', ['staff:manage', 'schedule:read:own'])).toBeUndefined();
    expect(() => assertCanAny('customer', ['staff:manage', 'shop:write'])).toThrow(
      ForbiddenError,
    );
    expect(canAny('customer', [])).toBe(false);
  });
});
