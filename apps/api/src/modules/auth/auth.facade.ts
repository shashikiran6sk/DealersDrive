/**
 * `auth` as other modules see it (ARCHITECTURE §5.5 rule 3).
 *
 * The principal types, because every scoped service takes one, and the
 * permission helpers. Note what is absent: no way to *construct* a principal.
 * Identity is resolved by the session resolver at the edge and passed inward —
 * a service can read who is calling and can never decide it.
 */
export type {
  AdminPrincipal,
  DealerPrincipal,
  Principal,
  SessionResolver,
} from './session.port.js';
export { permissionsForAdminRole, permissionsForRole } from './session.port.js';

/**
 * Per-role seats (**R41**). Exported because the admin console closes a
 * dealership's members' dealer seats when it suspends them, and that write
 * belongs to auth rather than to moderation — `users.status`, sessions and
 * seats are one model, and it has one owner.
 */
export { ensureSeat, isSeatSuspended, setSeatStatus, type RoleSeat } from './roles.js';
