import { z } from 'zod';

import { IndianMobile, Uuid } from './common.js';
import { AgreementAcceptance } from './legal-inputs.js';

export const CustomerName = z
  .string()
  .trim()
  .min(2, 'Enter your name.')
  .max(80, 'Keep your name under 80 characters.')
  .refine((value) => /\p{L}/u.test(value), 'Enter your name.')
  .refine((value) => !/\p{Cc}/u.test(value), 'Enter your name.');

export const CustomerSignInInput = z
  .object({
    phone: IndianMobile,
    accessToken: z.string().trim().min(1, 'The verification token is missing.').max(4096),
  })
  .strict();
export type CustomerSignInInput = z.infer<typeof CustomerSignInInput>;

export const CustomerProfile = z.object({
  id: Uuid,
  fullName: z.string(),
  phone: z.string(),
  phoneDisplay: z.string(),
});
export type CustomerProfile = z.infer<typeof CustomerProfile>;

export const CustomerSignInResponse = z.object({
  status: z.enum(['SIGNED_IN', 'NAME_REQUIRED', 'REACTIVATION_REQUIRED']),
  customer: CustomerProfile.nullable(),
  signUpToken: z.string().nullable(),
  expiresAt: z.string().nullable(),
  phoneDisplay: z.string(),
  reactivationToken: z.string().optional(),
  reactivationName: z.string().optional(),
});
export type CustomerSignInResponse = z.infer<typeof CustomerSignInResponse>;

export const CustomerSignUpInput = z
  .object({
    signUpToken: z.string().trim().min(1).max(2048),
    fullName: CustomerName,
    agreement: AgreementAcceptance.optional(),
  })
  .strict();
export type CustomerSignUpInput = z.infer<typeof CustomerSignUpInput>;

export const CustomerSession = z.object({ customer: CustomerProfile });
export type CustomerSession = z.infer<typeof CustomerSession>;
