import { z } from 'zod';

import { Uuid } from './common.js';
import { DealerRole, DealerStatus, type EnquiryStatus } from './enums.js';
import type { ListingLifecycleAction } from './listing.js';

/**
 * ── R92 · what each member of a dealership may do ──────────────────────────
 *
 * The one role → permission table, shared by the API (which enforces it) and
 * the web app (which hides what a role cannot do). Three fixed roles and no
 * per-member overrides: a dealership's OWNER runs the business, a MANAGER runs
 * the stock and the leads, and STAFF prepare drafts and call buyers back.
 *
 * It lives here rather than in the API because the console has to answer the
 * same question — "may this person close an enquiry?" — and a second copy of
 * the table is how a button comes to promise something the API refuses.
 * Hiding a control is never the authorization; `requirePermission` is.
 */
const ALL = ['OWNER', 'MANAGER', 'STAFF'] as const satisfies readonly DealerRole[];
const RUNS_STOCK = ['OWNER', 'MANAGER'] as const satisfies readonly DealerRole[];
const OWNER_ONLY = ['OWNER'] as const satisfies readonly DealerRole[];

export const DEALER_PERMISSIONS = {
  'vehicle:read': ALL,
  /** Create a draft, and edit one while it is still editable. */
  'vehicle:write': ALL,
  'vehicle:delete': RUNS_STOCK,
  /** Send a draft (or a car with changes requested) to moderation. */
  'listing:submit': RUNS_STOCK,
  'listing:reserve': RUNS_STOCK,
  'listing:sell': RUNS_STOCK,
  'listing:withdraw': RUNS_STOCK,
  /** Ask an admin to put a reserved or withdrawn car back on sale. */
  'listing:reactivate': RUNS_STOCK,
  'listing:renew': RUNS_STOCK,
  'enquiry:read': ALL,
  /** Move a new enquiry to CONTACTED — STAFF work the leads. */
  'enquiry:contact': ALL,
  /** Close, mark as spam, or reopen an enquiry. */
  'enquiry:close': RUNS_STOCK,
  'photo:request': RUNS_STOCK,
  'dealer:update': OWNER_ONLY,
  /** The dealership's KYC documents and verification. */
  'document:upload': OWNER_ONLY,
  'billing:read': RUNS_STOCK,
  'billing:purchase': OWNER_ONLY,
  /** Invite members, change their roles, remove them. */
  'member:manage': OWNER_ONLY,
} as const satisfies Record<string, readonly DealerRole[]>;

export type DealerPermission = keyof typeof DEALER_PERMISSIONS;

function isDealerPermission(key: string): key is DealerPermission {
  return Object.hasOwn(DEALER_PERMISSIONS, key);
}

export const DEALER_PERMISSION_NAMES: readonly DealerPermission[] =
  Object.keys(DEALER_PERMISSIONS).filter(isDealerPermission);

export function dealerPermissionsFor(role: DealerRole): DealerPermission[] {
  return DEALER_PERMISSION_NAMES.filter((permission) =>
    DEALER_PERMISSIONS[permission].some((candidate) => candidate === role),
  );
}

/**
 * Whether a set of granted permissions — a session's `permissions` — includes
 * this one. Takes the list rather than the role so the web app asks the same
 * question of the session the API already answered.
 */
export function canDealer(
  granted: readonly string[] | null | undefined,
  permission: DealerPermission,
): boolean {
  return granted?.includes(permission) ?? false;
}

/**
 * The permission an enquiry status change needs.
 *
 * Marking a new lead CONTACTED is the everyday move and every member may make
 * it. Anything else — closing, marking spam, reopening, or pulling a closed
 * enquiry back to CONTACTED — ends or undoes somebody's work, and needs
 * `enquiry:close`.
 */
export function enquiryTransitionPermission(
  from: EnquiryStatus,
  to: EnquiryStatus,
): DealerPermission {
  if (to === 'CONTACTED' && (from === 'NEW' || from === 'CONTACTED')) return 'enquiry:contact';
  return 'enquiry:close';
}

/**
 * The permission each lifecycle move needs (**R95**). The API filters the
 * moves it offers a member through this, so a STAFF member's inventory simply
 * has no Reserve button — and the route enforces the same permission if one is
 * called anyway.
 */
export const LIFECYCLE_ACTION_PERMISSION: Record<ListingLifecycleAction, DealerPermission> = {
  reserve: 'listing:reserve',
  markSold: 'listing:sell',
  withdraw: 'listing:withdraw',
  requestReactivation: 'listing:reactivate',
};

/** The roles an OWNER may hand out. OWNER is not one of them in V1. */
export const ASSIGNABLE_DEALER_ROLES = [
  'MANAGER',
  'STAFF',
] as const satisfies readonly DealerRole[];

export const DEALER_ROLE_LABELS: Record<DealerRole, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  STAFF: 'Staff',
};

/**
 * ── R93 · one account, several contexts ─────────────────────────────────────
 *
 * A signed-in person is a customer, and also a member of zero or more
 * dealerships. Entering a dealership's console is a choice among the person's
 * own memberships, made with the session they already have — never a second
 * sign-in, and never a second session.
 */
export const DealerWorkspace = z.object({
  /** What `PUT /v1/auth/workspaces/current` takes — never a dealer id (rule 1). */
  membershipId: Uuid,
  dealer: z.object({
    id: Uuid,
    slug: z.string(),
    brandName: z.string(),
    status: DealerStatus,
  }),
  role: DealerRole,
  roleLabel: z.string(),
  /** False while the dealership is suspended: listed, so the person knows why, but closed. */
  enterable: z.boolean(),
  /** The dealership `/dealer` opens for this session. */
  current: z.boolean(),
});
export type DealerWorkspace = z.infer<typeof DealerWorkspace>;

export const DealerWorkspacesResponse = z.object({ data: z.array(DealerWorkspace) });
export type DealerWorkspacesResponse = z.infer<typeof DealerWorkspacesResponse>;

/** Choose which of the person's own dealerships this session works in. */
export const SelectWorkspaceInput = z.object({ membershipId: Uuid }).strict();
export type SelectWorkspaceInput = z.infer<typeof SelectWorkspaceInput>;
