import type { CustomerSignUpInput } from './customer-auth.js';
import { z } from 'zod';

import { IndianMobile } from './common.js';
import { CustomerProfile } from './customer-auth.js';

export { CustomerSignUpInput } from './customer-auth.js';
export const NativeOtpRequestInput = z.object({ phone: IndianMobile }).strict();
export const NativeOtpChallengeInput = z
  .object({ challenge: z.string().min(1).max(2048) })
  .strict();
export const NativeOtpVerifyInput = NativeOtpChallengeInput.extend({
  otp: z.string().regex(/^\d{4,8}$/),
}).strict();
export const NativeOtpChallenge = z.object({
  challenge: z.string(),
  phoneDisplay: z.string(),
  expiresAt: z.iso.datetime(),
  retryAt: z.iso.datetime(),
});
export const NativeCustomerCredential = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  expiresAt: z.iso.datetime(),
});
export const NativeCustomerSignIn = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('REACTIVATION_REQUIRED'),
    reactivationToken: z.string(),
    expiresAt: z.iso.datetime(),
    phoneDisplay: z.string(),
    fullName: z.string(),
  }),
  z.object({
    status: z.literal('SIGNED_IN'),
    customer: CustomerProfile,
    credential: NativeCustomerCredential,
  }),
  z.object({
    status: z.literal('NAME_REQUIRED'),
    signUpToken: z.string(),
    expiresAt: z.iso.datetime(),
    phoneDisplay: z.string(),
  }),
]);
export const NativeCustomerSession = z.object({
  customer: CustomerProfile,
  expiresAt: z.iso.datetime(),
});
export const NativeCustomerSignUp = z.object({
  customer: CustomerProfile,
  credential: NativeCustomerCredential,
});
export type NativeOtpRequestInput = z.infer<typeof NativeOtpRequestInput>;
export type NativeOtpChallengeInput = z.infer<typeof NativeOtpChallengeInput>;
export type NativeOtpVerifyInput = z.infer<typeof NativeOtpVerifyInput>;
export type NativeOtpChallenge = z.infer<typeof NativeOtpChallenge>;
export type NativeCustomerSignIn = z.infer<typeof NativeCustomerSignIn>;
export type NativeCustomerSession = z.infer<typeof NativeCustomerSession>;
export type NativeCustomerSignUp = z.infer<typeof NativeCustomerSignUp>;
export type NativeCustomerSignUpInput = z.infer<typeof CustomerSignUpInput>;

export const LegalPublication = z.object({
  state: z.enum(['PUBLISHED', 'DRAFT', 'UNAVAILABLE']),
  collectionEnabled: z.boolean(),
  documents: z.array(
    z.object({
      id: z.enum(['terms', 'privacy']),
      title: z.string(),
      version: z.string(),
      digest: z.string(),
      reviewed: z.boolean(),
      effectiveDate: z.string().nullable(),
      sections: z.array(
        z.object({ id: z.string(), heading: z.string(), paragraphs: z.array(z.string()) }),
      ),
    }),
  ),
  sharing: z.object({ version: z.string(), text: z.string(), digest: z.string() }).nullable(),
});
export type LegalPublication = z.infer<typeof LegalPublication>;
