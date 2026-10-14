import { z } from 'zod';

export const AgreementAcceptance = z
  .object({
    version: z.string().min(1).max(40),
    accepted: z.literal(true),
    privacyAcknowledged: z.literal(true),
    privacyVersion: z.string().min(1).max(40).optional(),
  })
  .strict();
export type AgreementAcceptance = z.infer<typeof AgreementAcceptance>;

export const EnquirySharingPermission = z
  .object({
    version: z.string().min(1).max(40),
    granted: z.literal(true),
  })
  .strict();
export type EnquirySharingPermission = z.infer<typeof EnquirySharingPermission>;
