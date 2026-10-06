import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const dealerClaimsDocs: ModuleDocs = {
  tag: DOC_TAGS.dealerClaims,
  description:
    'Claiming an assisted dealership (**R113**). A Sales Representative creates the ' +
    'dealership with the dealer; a link is then emailed to the address they typed. The dealer ' +
    'opens it, **confirms the email** (a POST, so a mail scanner prefetching the link proves ' +
    'nothing), and then **claims** the dealership with an OTP on the mobile number verified ' +
    'during onboarding. Only both proofs together create the OWNER membership.\n\n' +
    'The token is 256 bits, single-purpose, stored only as a SHA-256, valid for 72 hours, and ' +
    'superseded by any newer link or a change of address. These routes need no session; they ' +
    'are rate-limited per IP, and the claim per number too. The email address is never copied ' +
    'onto the dealer’s account as a sign-in identity.',
  operations: [
    {
      method: 'get',
      path: '/v1/dealer-claims/:token',
      operationId: 'getDealerClaim',
      tag: DOC_TAGS.dealerClaims,
      summary: 'What this claim link is for',
      description:
        'The dealership’s name and town, the masked email and phone, who assisted, and the link’s `state`: `AWAITING_EMAIL`, `AWAITING_CLAIM`, `CLAIMED`, `EXPIRED` or `SUPERSEDED`. Reading changes nothing. An unknown token is a **404**.',
      audience: 'public',
      params: 'ClaimTokenParam',
      responses: [{ status: 200, description: 'The link’s state.', schema: 'DealerClaimPreview' }],
      errors: [400, 404, 429],
    },
    {
      method: 'post',
      path: '/v1/dealer-claims/:token/verify-email',
      operationId: 'verifyDealerClaimEmail',
      tag: DOC_TAGS.dealerClaims,
      summary: 'Confirm the dealership’s email address',
      description:
        'Marks the dealership’s `contactEmail` verified, provided it still equals the address the link was sent to. Idempotent once verified. An expired or superseded link is a **409**.',
      audience: 'public',
      params: 'ClaimTokenParam',
      responses: [
        { status: 200, description: 'Verified; the new state.', schema: 'DealerClaimPreview' },
      ],
      errors: [400, 404, 409, 429],
    },
    {
      method: 'post',
      path: '/v1/dealer-claims/:token/claim',
      operationId: 'claimDealer',
      tag: DOC_TAGS.dealerClaims,
      summary: 'Claim the dealership with an OTP on its verified phone',
      description:
        'Needs the email confirmed first (`409 CLAIM_EMAIL_FIRST`). The OTP must prove the dealership’s verified number (`403 CLAIM_PHONE_MISMATCH` otherwise). The account holding that number — created if there is none — becomes the OWNER and is signed in: the response sets the `dd_session` cookie. Refused for a team (staff) account, an account that already manages a dealership, a dealership that already has an owner, and a rejected or closed application. The OTP code never reaches the API.',
      audience: 'public',
      params: 'ClaimTokenParam',
      requestBody: {
        schema: 'ClaimDealerInput',
        description: 'The number and the provider token from the OTP widget.',
        example: { phone: '9840012345', accessToken: '<provider token>' },
      },
      responses: [
        {
          status: 200,
          description: 'Claimed and signed in.',
          schema: 'ClaimDealerResponse',
          headers: {
            'Set-Cookie': {
              description: 'The new dealer session.',
              schema: { type: 'string' },
            },
          },
        },
      ],
      errors: [400, 403, 404, 409, 422, 429, 503],
    },
  ],
};
