import { ForbiddenError } from '../../core/errors';

/**
 * Role-based access control.
 *
 * Permissions are `resource:action` strings; roles are ordered so a higher
 * role inherits everything below it. Routes declare the permission they
 * need, services re-check it before mutating — never only at the edge.
 */

export const ROLES = ['customer', 'barber', 'manager', 'owner', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // profile & identity
  'profile:read',
  'profile:write',
  'address:manage',
  'session:manage',
  // booking (own)
  'appointment:book',
  'appointment:read:own',
  'appointment:cancel:own',
  'appointment:reschedule:own',
  // discovery & engagement
  'favorite:manage',
  'review:create',
  'review:edit:own',
  'wallet:read',
  'receipt:read',
  'support:create',
  // staff workspace
  'schedule:read:own',
  'schedule:write:own',
  'appointment:read:assigned',
  'appointment:write:assigned',
  'earnings:read:own',
  'attendance:write:own',
  // shop operations
  'appointment:read:shop',
  'appointment:write:shop',
  'schedule:read:shop',
  'schedule:write:shop',
  'availability:write:staff',
  'service:read',
  'service:manage',
  'shop:read',
  'shop:write',
  'branch:manage',
  'staff:read',
  'staff:manage',
  'staff:commission:manage',
  'coupon:read',
  'coupon:manage',
  'review:moderate',
  'review:respond',
  'analytics:read:shop',
  'earnings:read:shop',
  'payment:read:shop',
  'refund:process',
  'leave:approve',
  // platform
  'user:manage',
  'shop:approve',
  'loyalty:manage',
  'support:respond',
  'audit:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const CustomerPermissions: Permission[] = [
  'profile:read',
  'profile:write',
  'address:manage',
  'session:manage',
  'appointment:book',
  'appointment:read:own',
  'appointment:cancel:own',
  'appointment:reschedule:own',
  'favorite:manage',
  'review:create',
  'review:edit:own',
  'wallet:read',
  'receipt:read',
  'support:create',
];

const BarberPermissions: Permission[] = [
  ...CustomerPermissions,
  'schedule:read:own',
  'schedule:write:own',
  'appointment:read:assigned',
  'appointment:write:assigned',
  'earnings:read:own',
  'attendance:write:own',
  'service:read',
  'shop:read',
];

const ManagerPermissions: Permission[] = [
  ...BarberPermissions,
  'appointment:read:shop',
  'appointment:write:shop',
  'schedule:read:shop',
  'schedule:write:shop',
  'availability:write:staff',
  'service:manage',
  'branch:manage',
  'staff:read',
  'staff:manage',
  'coupon:read',
  'coupon:manage',
  'review:moderate',
  'review:respond',
  'analytics:read:shop',
  'earnings:read:shop',
  'payment:read:shop',
  'refund:process',
  'leave:approve',
];

const OwnerPermissions: Permission[] = [
  ...ManagerPermissions,
  'shop:write',
  'staff:commission:manage',
  'audit:read',
];

const AdminPermissions: Permission[] = [
  ...new Set<Permission>([
    ...OwnerPermissions,
    'user:manage',
    'shop:approve',
    'loyalty:manage',
    'support:respond',
    'audit:read',
  ]),
];

const RolePermissions: Record<Role, ReadonlySet<Permission>> = {
  customer: new Set(CustomerPermissions),
  barber: new Set(BarberPermissions),
  manager: new Set(ManagerPermissions),
  owner: new Set(OwnerPermissions),
  admin: new Set(AdminPermissions),
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function permissionsFor(role: Role): ReadonlySet<Permission> {
  return RolePermissions[role];
}

export function can(role: Role, permission: Permission): boolean {
  return RolePermissions[role].has(permission);
}

export function canAny(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError(`Your role '${role}' cannot perform '${permission}'`);
  }
}

export function assertCanAny(role: Role, permissions: readonly Permission[]): void {
  if (!canAny(role, permissions)) {
    throw new ForbiddenError(
      `Your role '${role}' cannot perform any of: ${permissions.join(', ')}`,
    );
  }
}
