import type { OperationSpec } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const nativeAuthOperations: OperationSpec[] = [
  {
    method: 'post',
    path: '/v1/auth/native/customer/otp',
    operationId: 'requestNativeCustomerOtp',
    tag: DOC_TAGS.auth,
    summary: 'Request a customer OTP through the Dealers-Drive backend',
    description:
      'Native customer feature gate. Indian numbers only; server-held MSG91 widget credentials. Fail-closed shared-cache IP/number/cooldown/global spend limits. No account enumeration, provider token or cookies in the response. Production requires approved published policies. No automatic retry. Cache-Control: no-store.',
    audience: 'public',
    requestBody: { schema: 'NativeOtpRequestInput', required: true },
    responses: [
      {
        status: 200,
        description: 'Signed phone-bound challenge; resend and expiry timestamps.',
        schema: 'NativeOtpChallenge',
      },
    ],
    errors: [400, 422, 429, 503],
    rateLimit:
      '20 sends/IP/10 minutes, 5/number/hour, 1/number/minute and 1000/day globally; always fail closed.',
  },
  {
    method: 'post',
    path: '/v1/auth/native/customer/otp/resend',
    operationId: 'resendNativeCustomerOtp',
    tag: DOC_TAGS.auth,
    summary: 'Resend the current customer SMS challenge',
    description:
      'Same signed challenge/expiry/attempt budget. Maximum three resend attempts, plus shared send limits/cooldown. No client-provided phone/recipient/channel. Errors require explicit retry; no silent replay.',
    audience: 'public',
    requestBody: { schema: 'NativeOtpChallengeInput', required: true },
    responses: [
      { status: 200, description: 'Updated challenge timestamps.', schema: 'NativeOtpChallenge' },
    ],
    errors: [400, 422, 429, 503],
  },
  {
    method: 'post',
    path: '/v1/auth/native/customer/otp/verify',
    operationId: 'verifyNativeCustomerOtp',
    tag: DOC_TAGS.auth,
    summary: 'Verify an OTP and reuse the existing customer identity',
    description:
      'Five attempts per signed challenge; expiry/future/tamper/replay checks and fail-closed cache. Server verifies the provider access token and matching phone through the existing customer service. Signed-in results carry a revocable opaque CUSTOMER credential; first-time customers receive the existing single-use name/signup ticket. Deactivated customers receive REACTIVATION_REQUIRED with a single-use purpose-bound confirmation ticket and no session. No dealer/admin privilege, cookie, refresh token or automatic mutation retry. No-store.',
    audience: 'public',
    requestBody: { schema: 'NativeOtpVerifyInput', required: true },
    responses: [
      {
        status: 200,
        description: 'Existing customer session or name-required signup.',
        schema: 'NativeCustomerSignIn',
      },
    ],
    errors: [400, 403, 422, 429, 503],
  },
  {
    method: 'post',
    path: '/v1/auth/native/customer/sign-up',
    operationId: 'signUpNativeCustomer',
    tag: DOC_TAGS.auth,
    summary: 'Complete existing phone signup with the customer name',
    description:
      'Same identity, ticket replay guard, name validation and conditional Terms ACCEPT/Privacy ACKNOWLEDGE service as web. Reject fields not in the strict contract. Returns only a CUSTOMER credential; no cookie or new identity silo. Signed tickets are credentials and must not be logged.',
    audience: 'public',
    requestBody: { schema: 'CustomerSignUpInput', required: true },
    responses: [
      {
        status: 201,
        description: 'Customer and revocable opaque credential.',
        schema: 'NativeCustomerSignUp',
      },
    ],
    errors: [400, 403, 422, 503],
  },
  {
    method: 'get',
    path: '/v1/auth/native/customer/me',
    operationId: 'getNativeCustomerSession',
    tag: DOC_TAGS.auth,
    summary: 'Restore a native customer bearer session',
    description:
      'Authorization: Bearer <opaque credential> only, CUSTOMER scope and active named/phone-verified customer. Revoked/expired/suspended/dealer/admin credentials are refused. Private profile and authoritative session expiry; no-store. Policy changes never block logout or private account retrieval.',
    audience: 'customer',
    nativeBearer: true,
    responses: [
      { status: 200, description: 'Current customer and expiry.', schema: 'NativeCustomerSession' },
    ],
    errors: [401, 503],
  },
  {
    method: 'post',
    path: '/v1/auth/native/customer/logout',
    operationId: 'logoutNativeCustomer',
    tag: DOC_TAGS.auth,
    summary: 'Revoke the current native customer session',
    description:
      'Native CUSTOMER bearer only. Revokes only the presented native session; web cookie sessions are never revoked here. Idempotent: an expired or already-revoked credential also receives 204. A missing or malformed bearer receives 401. Available even while native sign-in is switched off, so an installed app can always revoke its credential. No browser cookie clearing, privileged session revocation or all-device promise.',
    audience: 'customer',
    nativeBearer: true,
    responses: [{ status: 204, description: 'Session revoked, or already inactive.' }],
    errors: [401],
  },
];
