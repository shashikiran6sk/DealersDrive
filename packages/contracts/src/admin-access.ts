import type { AdminRole } from './enums.js';

/**
 * ── What each internal team member may do ──────────────────────────────────
 *
 * The one role → permission table for Admin Members, shared by the API (which
 * enforces it on every request) and the web app (which hides what a role
 * cannot do). It is a fixed table in code, like `DEALER_PERMISSIONS`, rather
 * than rows somebody can edit: a permission is a promise the code keeps, and a
 * database row cannot add a check the code does not make.
 *
 * Two consoles, deliberately separate:
 *
 * - `admin:console` is the door to `/v1/admin/**` at all. SALES_REP does not
 *   hold it, so no admin route — present or future — is reachable by a Sales
 *   Representative, whatever that route forgets to check for itself.
 * - `sales:*` is the field-onboarding workspace under `/v1/sales/**`, scoped
 *   per resource to what the member assisted. No reviewer action is in it.
 *
 * Hiding a control is never the authorization; the API's check is.
 */
const CONSOLE = ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'] as const satisfies readonly AdminRole[];
const REVIEWERS = ['MODERATOR', 'SUPER_ADMIN'] as const satisfies readonly AdminRole[];
const SUPER = ['SUPER_ADMIN'] as const satisfies readonly AdminRole[];
const SALES = ['SALES_REP'] as const satisfies readonly AdminRole[];

export const ADMIN_PERMISSIONS = {
  'admin:console': CONSOLE,
  'admin:dealer:approve': REVIEWERS,
  'admin:document:review': REVIEWERS,
  'admin:listing:moderate': REVIEWERS,
  'admin:media:upload': REVIEWERS,
  'admin:credit:grant': SUPER,
  'admin:payment:read': CONSOLE,
  'admin:payment:refund': SUPER,
  'admin:config:write': SUPER,
  /** Invite, re-role, disable and re-activate Admin Members. */
  'admin:access:manage': SUPER,
  'admin:audit:read': CONSOLE,
  'admin:metrics:read': CONSOLE,
  'admin:enquiry:read': CONSOLE,
  'admin:support:manage': CONSOLE,
  /** Enter the Sales workspace. */
  'sales:workspace': SALES,
  /** Start an assisted dealership and verify the dealer's phone. */
  'sales:dealer:create': SALES,
  /** Read the dealerships this member assisted — never anyone else's. */
  'sales:dealer:read': SALES,
  /** Edit an assisted dealership while it is still a draft. */
  'sales:dealer:edit': SALES,
  /** Send an assisted dealership into the ordinary verification review. */
  'sales:dealer:submit': SALES,
  /** Prepare a listing draft for an assisted dealership. */
  'sales:listing:create': SALES,
  'sales:listing:read': SALES,
  'sales:listing:edit': SALES,
  /** Send an assisted draft into the ordinary listing review. */
  'sales:listing:submit': SALES,
} as const satisfies Record<string, readonly AdminRole[]>;

export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;

function isAdminPermission(key: string): key is AdminPermission {
  return Object.hasOwn(ADMIN_PERMISSIONS, key);
}

export const ADMIN_PERMISSION_NAMES: readonly AdminPermission[] =
  Object.keys(ADMIN_PERMISSIONS).filter(isAdminPermission);

export function adminPermissionsFor(role: AdminRole): AdminPermission[] {
  return ADMIN_PERMISSION_NAMES.filter((permission) =>
    ADMIN_PERMISSIONS[permission].some((candidate) => candidate === role),
  );
}

/** Whether a session's granted permissions include this one. */
export function canAdmin(
  granted: readonly string[] | null | undefined,
  permission: AdminPermission,
): boolean {
  return granted?.includes(permission) ?? false;
}

export const ADMIN_ROLE_LABELS: Readonly<Record<AdminRole, string>> = {
  SUPER_ADMIN: 'Super admin',
  MODERATOR: 'Operations',
  SUPPORT: 'Support',
  SALES_REP: 'Sales representative',
};

/** Where a signed-in member lands: the console, or the Sales workspace. */
export function adminHomeFor(role: AdminRole): '/admin' | '/sales' {
  return role === 'SALES_REP' ? '/sales' : '/admin';
}
