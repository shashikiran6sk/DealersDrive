export type {
  AdminPrincipal,
  DealerPrincipal,
  Principal,
  SessionResolver,
} from './session.port.js';
export { permissionsForAdminRole, permissionsForRole } from './session.port.js';

export {
  ensureSeat,
  grantSeat,
  hasGrantedSeat,
  isSeatSuspended,
  setSeatStatus,
  type RoleSeat,
} from './roles.js';

export { isAllowlistedAdmin } from './admin-allowlist.js';

export { assertPhoneVerified } from './verified-phone.js';
