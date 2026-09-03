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
