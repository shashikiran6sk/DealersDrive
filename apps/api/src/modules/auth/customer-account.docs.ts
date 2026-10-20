import type { OperationSpec } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const customerAccountOperations: OperationSpec[] = [
  {
    method: 'get',
    path: '/v1/auth/customer/account',
    operationId: 'getCustomerAccountControls',
    tag: DOC_TAGS.auth,
    summary: 'Customer account controls',
    description:
      'Own-only account controls. canDeactivate requires a live CUSTOMER session created through PHONE_OTP within ten minutes. Dealer-person cookies do not qualify for deactivation. No-store.',
    audience: 'customer',
    responses: [
      {
        status: 200,
        description: 'Fresh authentication capability.',
        schema: 'CustomerAccountStatus',
      },
    ],
    errors: [401],
  },
  {
    method: 'post',
    path: '/v1/auth/customer/account/deactivate',
    operationId: 'deactivateCustomerAccount',
    tag: DOC_TAGS.auth,
    summary: 'Temporarily deactivate customer access',
    description:
      'Requires explicit confirmation and fresh OTP CUSTOMER session. User lock serializes protected writes and login. Atomically withdraws future scoped/legacy dealer disclosure, sets the dedicated customerDeactivatedAt flag and revokes CUSTOMER sessions. Retains records; no global User/role suspension, privileged session revocation or account erasure. Browser cookie clears after success; bearer responses contain no cookies. Invalid browser Origin is refused. No-store.',
    audience: 'customer',
    requestBody: { schema: 'CustomerDeactivationInput', required: true },
    responses: [
      {
        status: 200,
        description: 'Confirmed deactivation.',
        schema: 'CustomerDeactivationReceipt',
      },
    ],
    errors: [400, 401, 403],
  },
  {
    method: 'post',
    path: '/v1/auth/customer/reactivate',
    operationId: 'reactivateCustomerAccount',
    tag: DOC_TAGS.auth,
    summary: 'Confirm customer reactivation after OTP',
    description:
      'Fresh phone verification returns REACTIVATION_REQUIRED without a session for deactivated customers. Confirm its ten-minute purpose/user/phone-bound HMAC ticket. Shared-cache single-use guard fails closed; global/customer-role suspension and changed phone remain refused. Issues only a CUSTOMER cookie/session for the same User. Existing sharing withdrawals remain immutable; no automatic grant restoration. Ticket is a credential: JSON body only, never logs/URLs. No-store.',
    audience: 'public',
    requestBody: { schema: 'CustomerReactivationInput', required: true },
    responses: [
      {
        status: 200,
        description: 'Reactivated same customer; HttpOnly session cookie.',
        schema: 'CustomerSession',
      },
    ],
    errors: [400, 403, 422, 429, 503],
  },
  {
    method: 'post',
    path: '/v1/auth/native/customer/reactivate',
    operationId: 'reactivateNativeCustomerAccount',
    tag: DOC_TAGS.auth,
    summary: 'Confirm native customer reactivation',
    description:
      'Same purpose-bound single-use OTP reactivation as the website, under the existing native feature/publication gates. Returns only a CUSTOMER opaque credential and the same User profile, never browser cookies or privileged access. Retains withdrawal evidence. No-store.',
    audience: 'public',
    requestBody: { schema: 'CustomerReactivationInput', required: true },
    responses: [
      {
        status: 200,
        description: 'Reactivated same customer and opaque credential.',
        schema: 'NativeCustomerSignUp',
      },
    ],
    errors: [400, 403, 422, 503],
  },
];
