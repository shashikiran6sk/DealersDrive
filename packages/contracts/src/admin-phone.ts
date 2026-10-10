import { z } from 'zod';
import { normaliseIndianMobile } from './common.js';

export const AdminPhonePurpose = z.enum(['ENROLL', 'LOGIN']);
export type AdminPhonePurpose = z.infer<typeof AdminPhonePurpose>;
export const AdminPhoneChallengeInput = z
  .object({
    phone: z
      .string()
      .trim()
      .max(32)
      .refine(
        (value) => normaliseIndianMobile(value) !== null,
        'Enter a valid Indian mobile number.',
      ),
  })
  .strict();
export type AdminPhoneChallengeInput = z.infer<typeof AdminPhoneChallengeInput>;
export const AdminPhoneVerifyInput = z
  .object({
    challengeId: z.uuid(),
    browserToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    accessToken: z.string().trim().min(1).max(8192),
  })
  .strict();
export type AdminPhoneVerifyInput = z.infer<typeof AdminPhoneVerifyInput>;
export const AdminPhoneRevokeInput = z.object({ confirm: z.literal(true) }).strict();
export const AdminPhoneChallengeResponse = z.object({
  challengeId: z.uuid(),
  browserToken: z.string(),
  expiresAt: z.iso.datetime(),
  resendAfterSeconds: z.number().int(),
});
export type AdminPhoneChallengeResponse = z.infer<typeof AdminPhoneChallengeResponse>;
export const AdminPhoneSecurity = z.object({
  linked: z.boolean(),
  phoneMasked: z.string().nullable(),
  phoneVerifiedAt: z.iso.datetime().nullable(),
  requiresGoogleReauthentication: z.boolean(),
});
export type AdminPhoneSecurity = z.infer<typeof AdminPhoneSecurity>;
