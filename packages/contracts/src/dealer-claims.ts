import { z } from 'zod';

import { VerifyPhoneInput } from './auth.js';

/**
 * ── Claiming an assisted dealership (R113) ─────────────────────────────────
 *
 * A Sales Representative creates the dealership with the dealer present; the
 * dealer then owns it by proving two things the representative could not have
 * proved for them:
 *
 *  1. that they receive mail at the address the representative typed — by
 *     opening the link sent there and confirming, and
 *  2. that they hold the phone that was verified during onboarding — by an OTP
 *     on that number.
 *
 * Only both together make anyone an OWNER. The email is never copied onto the
 * dealer's account as a sign-in identity.
 */
export const ClaimTokenParam = z
  .object({
    token: z
      .string()
      .min(32, 'This link is incomplete.')
      .max(128, 'This link is not valid.')
      .regex(/^[A-Za-z0-9_-]+$/, 'This link is not valid.'),
  })
  .strict();
export type ClaimTokenParam = z.infer<typeof ClaimTokenParam>;

export const DealerClaimState = z.enum([
  'AWAITING_EMAIL',
  'AWAITING_CLAIM',
  'CLAIMED',
  'EXPIRED',
  'SUPERSEDED',
]);
export type DealerClaimState = z.infer<typeof DealerClaimState>;

export const DealerClaimPreview = z.object({
  state: DealerClaimState,
  dealerName: z.string(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  /** `m•••••@example.in` — enough to recognise, not enough to harvest. */
  emailMasked: z.string(),
  /** `+91 ••••• •2345` — the number the OTP will go to. */
  phoneMasked: z.string(),
  /** The full number is only ever what the dealer types themselves. */
  phoneLast4: z.string(),
  assistedBy: z.string().nullable(),
  expiresAt: z.string().nullable(),
});
export type DealerClaimPreview = z.infer<typeof DealerClaimPreview>;

export const ClaimDealerInput = VerifyPhoneInput.strict();
export type ClaimDealerInput = z.infer<typeof ClaimDealerInput>;

export const ClaimDealerResponse = z.object({
  dealerId: z.string(),
  returnTo: z.string(),
});
export type ClaimDealerResponse = z.infer<typeof ClaimDealerResponse>;

export const SalesEmailVerification = z.object({
  email: z.string(),
  sentAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  claimedAt: z.string().nullable(),
  /** False while the cooldown after the last send is running. */
  canResend: z.boolean(),
});
export type SalesEmailVerification = z.infer<typeof SalesEmailVerification>;
