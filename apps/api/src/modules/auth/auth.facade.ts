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
export {
  ensureSeat,
  grantSeat,
  hasGrantedSeat,
  isSeatSuspended,
  setSeatStatus,
  type RoleSeat,
} from './roles.js';

/**
 * Who the deployment says may hold an admin seat (**R42**).
 *
 * Exported because the settings screen has to *show* the difference between an
 * allow-listed address and a granted one, and refuse to withdraw the first. The
 * list itself is still read only here, from `env` — this hands out the question,
 * never the answer's source.
 */
export { isAllowlistedAdmin } from './admin-allowlist.js';

/**
 * The one rule every write that stores a dealer's number obeys (**R39**).
 *
 * Exported because the profile edit is a *dealers* write and the column it
 * would otherwise touch belongs to auth: `users.phone` holds a number somebody
 * proved, and `POST /v1/auth/phone/verify` is the only thing that may put one
 * there. This hands out the assertion, never the write.
 */
export { assertPhoneVerified } from './verified-phone.js';
