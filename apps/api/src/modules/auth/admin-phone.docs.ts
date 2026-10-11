import type { OperationSpec } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const adminPhoneOperations: OperationSpec[] = [
  {
    method: 'get',
    path: '/v1/auth/admin/phone/widget',
    operationId: 'adminPhoneWidget',
    tag: DOC_TAGS.auth,
    summary: 'Admin mobile provider availability',
    description:
      'Public widget configuration only; never the MSG91 auth key. Private, uncached verification still occurs on the server.',
    audience: 'public',
    responses: [{ status: 200, description: 'Widget availability.', schema: 'PhoneOtpWidget' }],
  },
  {
    method: 'get',
    path: '/v1/admin/profile/security',
    operationId: 'adminPhoneSecurity',
    tag: DOC_TAGS.auth,
    summary: 'Own admin mobile security status',
    description:
      'Only a masked credential and freshness status. Customer and dealer phone identities are separate.',
    audience: 'admin',
    permission: 'admin:console',
    responses: [{ status: 200, description: 'Own security status.', schema: 'AdminPhoneSecurity' }],
    errors: [401, 403],
  },
  ...(['LOGIN', 'ENROLL'] as const).flatMap((purpose): OperationSpec[] => {
    const base = purpose === 'LOGIN' ? '/v1/auth/admin/phone' : '/v1/admin/profile/security/phone';
    return [
      {
        method: 'post',
        path: `${base}/challenge`,
        operationId: `adminPhone${purpose}Challenge`,
        tag: DOC_TAGS.auth,
        summary: `Start admin phone ${purpose.toLowerCase()}`,
        description:
          'Trusted Origin and JSON required. Five-minute challenge with a browser nonce, persistent number cooldown and quota, fail-closed IP limiting. Unknown login numbers receive the same response. Enrollment requires a Google admin session created within ten minutes.',
        audience: purpose === 'LOGIN' ? 'public' : 'admin',
        requestBody: { schema: 'AdminPhoneChallengeInput' },
        responses: [
          {
            status: 200,
            description: 'Browser-bound challenge. Keep the nonce private.',
            schema: 'AdminPhoneChallengeResponse',
          },
        ],
        errors: [400, 401, 403, 409, 429, 503],
      },
      {
        method: 'post',
        path: `${base}/verify`,
        operationId: `adminPhone${purpose}Verify`,
        tag: DOC_TAGS.auth,
        summary: `Complete admin phone ${purpose.toLowerCase()}`,
        description:
          'Purpose, browser binding, expiry and five-attempt limit are checked server-side. MSG91 verifies the proof and its identifier; admin proofs also require fresh issued-at and unexpired expiry claims. A durable hash prevents replay. Admission is rechecked transactionally. Enrollment never creates an admin; login rotates an isolated dd_admin_session. Errors do not reveal account ownership.',
        audience: purpose === 'LOGIN' ? 'public' : 'admin',
        requestBody: { schema: 'AdminPhoneVerifyInput' },
        responses: [
          {
            status: 200,
            description:
              purpose === 'LOGIN'
                ? 'Admin session issued; redirect to /admin.'
                : 'Credential linked.',
            ...(purpose === 'ENROLL'
              ? { schema: 'AdminPhoneSecurity' }
              : {
                  inlineSchema: {
                    type: 'object',
                    properties: { returnTo: { type: 'string', const: '/admin' } },
                    required: ['returnTo'],
                  },
                }),
          },
        ],
        errors: [400, 401, 403, 503],
      },
    ];
  }),
  {
    method: 'post',
    path: '/v1/admin/profile/security/phone/revoke',
    operationId: 'revokeAdminPhone',
    tag: DOC_TAGS.auth,
    summary: 'Revoke own admin mobile credential',
    description:
      'Requires recent Google assurance, trusted Origin, JSON and explicit confirmation. Revokes the credential, pending challenges and all ADMIN sessions atomically with an audit event. Person sessions stay valid. Recovery requires signing in again with Google before enrolling another number.',
    audience: 'admin',
    permission: 'admin:console',
    requestBody: { schema: 'AdminPhoneRevokeInput' },
    responses: [{ status: 204, description: 'Credential revoked; admin cookie cleared.' }],
    errors: [400, 401, 403],
  },
];
