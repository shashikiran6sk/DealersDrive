export type {
  AdminPrincipal,
  CustomerPrincipal,
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

export type { PhoneProofService } from './phone-proof.service.js';

export { authorizeDealerWrite, type DealerWriteActor } from './dealer-write-authorization.js';

export {
  findMemberByUser,
  isAdmitted,
  permissionsForMember,
  revokeAdminSessions,
  syncLegacyAdminColumns,
} from './admin-member.js';
