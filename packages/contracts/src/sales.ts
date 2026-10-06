import { z } from 'zod';

import { OnboardingInput, VerifyPhoneInput } from './auth.js';
import { Uuid } from './common.js';
import { SalesEmailVerification } from './dealer-claims.js';
import {
  CompletenessResponse,
  DealerDocumentDto,
  UpdateDealerInput,
  YardPhotoDto,
} from './dealer.js';
import { DealerStatus, StatusTone } from './enums.js';

/**
 * ── The Sales workspace (R112) ─────────────────────────────────────────────
 *
 * A Sales Representative onboards a dealership *with* the dealer, in person.
 * The dealership is the same row, with the same review lifecycle, as one the
 * dealer created themselves; what differs is who typed it, and that is
 * recorded rather than hidden.
 *
 * The phone is proved first, on the dealer's own handset: the dealer reads the
 * code out, the representative types it, and the server verifies it with the
 * provider. The answer is a short-lived, single-use ticket bound to this
 * representative and this number, and the dealership can only be created by
 * redeeming it. There is no way to create one with a typed number.
 */
export const SalesPhoneVerifyInput = VerifyPhoneInput.extend({
  /**
   * The dealer's consent, given by sharing the code. Must be `true`: the
   * screen shows the sentence, and the server records when it was agreed.
   */
  consent: z.literal(true, {
    error: 'The dealership representative must agree before the code is checked.',
  }),
}).strict();
export type SalesPhoneVerifyInput = z.infer<typeof SalesPhoneVerifyInput>;

export const SalesPhoneVerifyResponse = z.object({
  phone: z.string(),
  phoneDisplay: z.string(),
  verifiedAt: z.string(),
  /** Redeemed once by `POST /v1/sales/dealers`. */
  phoneTicket: z.string(),
  expiresAt: z.string(),
});
export type SalesPhoneVerifyResponse = z.infer<typeof SalesPhoneVerifyResponse>;

const ContactName = z.string().trim().min(2, 'Enter the contact person’s name.').max(80);
const ContactEmail = z.string().trim().toLowerCase().email('Enter a valid email address.').max(160);

/**
 * The same business fields, with the same rules, as the dealer's own
 * onboarding — `OnboardingInput` minus who is typing (`fullName`, `phone`),
 * plus the contact the representative is speaking to.
 */
export const CreateAssistedDealerInput = OnboardingInput.omit({ fullName: true, phone: true })
  .extend({
    phoneTicket: z.string().trim().min(1).max(2048),
    contactName: ContactName,
    email: ContactEmail,
    gstin: UpdateDealerInput.shape.gstin,
    pan: UpdateDealerInput.shape.pan,
  })
  .strict();
export type CreateAssistedDealerInput = z.infer<typeof CreateAssistedDealerInput>;

/** A partial patch while the dealership is still a draft. The phone is not in it. */
export const UpdateAssistedDealerInput = CreateAssistedDealerInput.omit({ phoneTicket: true })
  .partial()
  .strict();
export type UpdateAssistedDealerInput = z.infer<typeof UpdateAssistedDealerInput>;

export const SalesDealersQuery = z.object({ status: DealerStatus.optional() }).strict();
export type SalesDealersQuery = z.infer<typeof SalesDealersQuery>;

export const SalesDealerSummary = z.object({
  id: Uuid,
  legalName: z.string(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  status: DealerStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  statusReason: z.string().nullable(),
  contactName: z.string().nullable(),
  phoneDisplay: z.string(),
  phoneVerified: z.boolean(),
  emailVerified: z.boolean(),
  claimed: z.boolean(),
  createdAt: z.string(),
  listings: z.object({ draft: z.number().int(), review: z.number().int(), live: z.number().int() }),
});
export type SalesDealerSummary = z.infer<typeof SalesDealerSummary>;

export const SalesDealersResponse = z.object({
  data: z.array(SalesDealerSummary),
  counts: z.record(z.string(), z.number().int()),
});
export type SalesDealersResponse = z.infer<typeof SalesDealersResponse>;

export const SalesDealerDetail = SalesDealerSummary.extend({
  email: z.string().nullable(),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  tagline: z.string().nullable(),
  specialities: z.array(z.string()),
  landline: z.string().nullable(),
  address: z.object({
    line: z.string().nullable(),
    city: z.string().nullable(),
    district: z.string().nullable(),
    state: z.string().nullable(),
    pincode: z.string().nullable(),
    mapsUrl: z.string().nullable(),
  }),
  consentAt: z.string().nullable(),
  phoneVerifiedAt: z.string().nullable(),
  completeness: CompletenessResponse,
  documents: z.array(DealerDocumentDto),
  yardPhoto: YardPhotoDto,
  canEdit: z.boolean(),
  canSubmit: z.boolean(),
  /** The latest verification link (**R113**); null before the first is requested. */
  emailVerification: SalesEmailVerification.nullable(),
});
export type SalesDealerDetail = z.infer<typeof SalesDealerDetail>;

export const SalesMetric = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number().int(),
  href: z.string().nullable(),
});
export type SalesMetric = z.infer<typeof SalesMetric>;

export const SalesDashboard = z.object({
  member: z.object({ name: z.string().nullable(), email: z.string() }),
  metrics: z.array(SalesMetric),
  recent: z.array(SalesDealerSummary),
});
export type SalesDashboard = z.infer<typeof SalesDashboard>;

export const ASSISTED_CONSENT_TEXT =
  'By sharing this OTP, the dealership representative authorises Dealers-Drive to create and submit this dealership profile for verification.';

export const SalesDealerDocParam = z
  .object({ id: Uuid, type: z.enum(['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']) })
  .strict();
export type SalesDealerDocParam = z.infer<typeof SalesDealerDocParam>;
