import { createHash } from 'node:crypto';
import {
  ProgressiveVerificationPlan,
  type ProgressiveVerificationPlan as Plan,
} from '@dealers-drive/contracts';
import { z } from 'zod';

const Stored = z.object({
  plan: ProgressiveVerificationPlan,
  identityHash: z.string(),
  reviewerId: z.string().uuid(),
  reviewedAt: z.string(),
});
export function progressivePlan(raw: unknown): Plan | null {
  const parsed = Stored.safeParse(raw);
  return parsed.success ? parsed.data.plan : null;
}
export function progressiveIdentityHash(dealer: {
  contactName?: string | null;
  legalName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  addressLine: string | null;
  pincode: string | null;
  gstin: string | null;
  pan: string | null;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        dealer.legalName,
        dealer.contactName,
        dealer.contactPhone,
        dealer.contactEmail,
        dealer.city,
        dealer.district,
        dealer.state,
        dealer.addressLine,
        dealer.pincode,
        dealer.gstin,
        dealer.pan,
      ]),
    )
    .digest('hex');
}
export function isProgressivePlanCurrent(
  dealer: Parameters<typeof progressiveIdentityHash>[0] & { progressivePlan: unknown },
): boolean {
  const parsed = Stored.safeParse(dealer.progressivePlan);
  return parsed.success && parsed.data.identityHash === progressiveIdentityHash(dealer);
}
