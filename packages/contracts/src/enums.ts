import { z } from 'zod';

/**
 * The domain vocabulary, defined once. Every enum here matches a Prisma enum
 * of the same name; the API parses inbound values with these schemas and the
 * web app renders them through the label maps below, so a value and its
 * human-readable form can never drift apart between the two apps.
 */

export const FuelType = z.enum(['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', 'LPG']);
export type FuelType = z.infer<typeof FuelType>;

export const Transmission = z.enum(['MANUAL', 'AUTOMATIC']);
export type Transmission = z.infer<typeof Transmission>;

export const BodyType = z.enum(['HATCHBACK', 'SEDAN', 'SUV', 'MUV', 'LUXURY']);
export type BodyType = z.infer<typeof BodyType>;

export const InsuranceType = z.enum(['COMPREHENSIVE', 'THIRD_PARTY', 'NONE']);
export type InsuranceType = z.infer<typeof InsuranceType>;

export const PriceNegotiability = z.enum(['SLIGHTLY', 'FIXED']);
export type PriceNegotiability = z.infer<typeof PriceNegotiability>;

export const VehicleStatus = z.enum(['DRAFT', 'READY', 'SOLD', 'ARCHIVED']);
export type VehicleStatus = z.infer<typeof VehicleStatus>;

export const ListingStatus = z.enum([
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'SOLD',
  'REMOVED',
]);
export type ListingStatus = z.infer<typeof ListingStatus>;

/**
 * The single derived status the UI renders (ARCHITECTURE §27). Computed once,
 * in the API's DTO mapper — if two clients ever derived it independently they
 * would disagree, and the disagreement would be about whether a dealer's car
 * is live.
 */
export const DisplayStatus = z.enum([
  'DRAFT',
  'PENDING',
  'CHANGES_REQUESTED',
  'ACTIVE',
  'REJECTED',
  'EXPIRED',
  'SOLD',
  'REMOVED',
]);
export type DisplayStatus = z.infer<typeof DisplayStatus>;

export const DealerStatus = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'REJECTED',
  'CLOSED',
]);
export type DealerStatus = z.infer<typeof DealerStatus>;

export const DealerRole = z.enum(['OWNER', 'MANAGER', 'SALES']);
export type DealerRole = z.infer<typeof DealerRole>;

export const AdminRole = z.enum(['SUPPORT', 'MODERATOR', 'SUPER_ADMIN']);
export type AdminRole = z.infer<typeof AdminRole>;

export const DealerDocType = z.enum(['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']);
export type DealerDocType = z.infer<typeof DealerDocType>;

export const DocStatus = z.enum(['REQUIRED', 'UPLOADING', 'UPLOADED', 'VERIFIED', 'REJECTED']);
export type DocStatus = z.infer<typeof DocStatus>;

export const EnquirySource = z.enum(['LISTING_PAGE', 'CALL_BUTTON', 'DEALER_PAGE']);
export type EnquirySource = z.infer<typeof EnquirySource>;

export const EnquiryStatus = z.enum(['NEW', 'CONTACTED', 'CLOSED', 'SPAM']);
export type EnquiryStatus = z.infer<typeof EnquiryStatus>;

export const CloseReason = z.enum(['SOLD', 'NOT_INTERESTED', 'UNREACHABLE', 'OTHER']);
export type CloseReason = z.infer<typeof CloseReason>;

export const CreditReason = z.enum([
  'PURCHASE',
  'ADMIN_GRANT',
  'HOLD_SUBMIT',
  'RELEASE_REJECT',
  'RELEASE_EXPIRED_UNREVIEWED',
  'CONSUME_APPROVE',
  'ADMIN_ADJUSTMENT',
  'REVERSAL',
]);
export type CreditReason = z.infer<typeof CreditReason>;

export const OrderStatus = z.enum(['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED']);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PaymentStatus = z.enum(['CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED']);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const InvoiceStatus = z.enum(['CAPTURED', 'FAILED', 'REFUNDED']);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

export const MediaStatus = z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED']);
export type MediaStatus = z.infer<typeof MediaStatus>;

export const PhotoRequestStatus = z.enum(['REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED']);
export type PhotoRequestStatus = z.infer<typeof PhotoRequestStatus>;

/** Maps 1:1 to the badge fills in DESIGN-SPEC §2.5. */
export const StatusTone = z.enum(['ok', 'warn', 'err', 'neutral', 'accent']);
export type StatusTone = z.infer<typeof StatusTone>;

// ─────────── labels ────────────────────────────────────────────────────────
// Sentence case throughout (DESIGN-SPEC §4.13).

export const FUEL_LABELS: Record<FuelType, string> = {
  PETROL: 'Petrol',
  DIESEL: 'Diesel',
  CNG: 'CNG',
  ELECTRIC: 'Electric',
  HYBRID: 'Hybrid',
  LPG: 'LPG',
};

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  MANUAL: 'Manual',
  AUTOMATIC: 'Automatic',
};

export const BODY_TYPE_LABELS: Record<BodyType, string> = {
  HATCHBACK: 'Hatchback',
  SEDAN: 'Sedan',
  SUV: 'SUV',
  MUV: 'MUV',
  LUXURY: 'Luxury',
};

export const INSURANCE_LABELS: Record<InsuranceType, string> = {
  COMPREHENSIVE: 'Comprehensive',
  THIRD_PARTY: 'Third party',
  NONE: 'None',
};

export const NEGOTIABILITY_LABELS: Record<PriceNegotiability, string> = {
  SLIGHTLY: 'Slightly negotiable',
  FIXED: 'Fixed price, no hidden charges',
};

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending review',
  CHANGES_REQUESTED: 'Changes requested',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  SOLD: 'Sold',
  REMOVED: 'Removed',
};

export const DISPLAY_STATUS_TONES: Record<DisplayStatus, StatusTone> = {
  DRAFT: 'neutral',
  PENDING: 'warn',
  CHANGES_REQUESTED: 'warn',
  ACTIVE: 'ok',
  REJECTED: 'err',
  EXPIRED: 'neutral',
  SOLD: 'accent',
  REMOVED: 'neutral',
};

export const DEALER_STATUS_LABELS: Record<DealerStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};

export const DEALER_STATUS_TONES: Record<DealerStatus, StatusTone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warn',
  ACTIVE: 'ok',
  SUSPENDED: 'err',
  REJECTED: 'err',
  CLOSED: 'neutral',
};

export const ENQUIRY_SOURCE_LABELS: Record<EnquirySource, string> = {
  LISTING_PAGE: 'Listing page',
  CALL_BUTTON: 'Call button',
  DEALER_PAGE: 'Dealer page',
};

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  CLOSED: 'Closed',
  SPAM: 'Spam',
};

export const DOC_TYPE_LABELS: Record<DealerDocType, string> = {
  GST_CERTIFICATE: 'GST certificate',
  PAN_CARD: 'PAN card',
  ADDRESS_PROOF: 'Address proof',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  CAPTURED: 'Captured',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  CREATED: 'Created',
  AUTHORIZED: 'Authorized',
  CAPTURED: 'Captured',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

/** "1st owner" reads badly in a spec table; the product says "First owner". */
export function ownerLabel(n: number): string {
  const words = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth'];
  return `${words[n] ?? `${n}th`} owner`;
}

// ─────────── vehicle records (RC lookup + history report) ──────────────────
//
// Kept together at the end rather than filed among the enums above, because
// they share one property none of the others have: **they describe what a
// government record says, not what Dealers-Drive decided.** `UNKNOWN` and
// `UNAVAILABLE` therefore have to exist and have to be rendered — a missing
// challan feed must never be presented as a clean record (ARCHITECTURE §6.3).

/**
 * How sure the resolver is that a VAHAN maker string maps to a known brand.
 *
 * Under decision D1 the seeded catalogue is gone, so the resolver matches
 * against `apps/api/src/platform/rc/rc-aliases.ts` — a committed constant —
 * rather than a database row. The confidence levels are unchanged.
 *
 * `LIKELY` is not `EXACT` with better manners. The wizard renders the two
 * differently on purpose: an EXACT match is stated, a LIKELY one is offered
 * for confirmation, and a dealer who cannot tell them apart will publish
 * somebody else's model name.
 */
export const RcMatchConfidence = z.enum(['EXACT', 'LIKELY', 'NONE']);
export type RcMatchConfidence = z.infer<typeof RcMatchConfidence>;

/**
 * `UNKNOWN` means we could not read the blacklist block, and is deliberately
 * distinct from `CLEAR`. Collapsing them would turn a provider outage into a
 * clean bill of health on a stolen car.
 */
export const BlacklistStatus = z.enum(['CLEAR', 'BLACKLISTED', 'NOC_ISSUED', 'UNKNOWN']);
export type BlacklistStatus = z.infer<typeof BlacklistStatus>;

export const ChallanStatus = z.enum(['PAID', 'UNPAID', 'DISPOSED']);
export type ChallanStatus = z.infer<typeof ChallanStatus>;

/**
 * The one-word answer at the top of a report.
 *
 * `UNAVAILABLE` is a first-class outcome, not an error state — it is what an
 * honest report says when the state's feed is quiet, and it is the difference
 * between a records check and a warranty.
 */
export const ReportVerdict = z.enum(['CLEAR', 'ATTENTION', 'FLAGGED', 'UNAVAILABLE']);
export type ReportVerdict = z.infer<typeof ReportVerdict>;

export const RC_CONFIDENCE_LABELS: Record<RcMatchConfidence, string> = {
  EXACT: 'From the RC',
  LIKELY: 'Best match — please check',
  NONE: 'Not found — please choose',
};

export const BLACKLIST_LABELS: Record<BlacklistStatus, string> = {
  CLEAR: 'No flags on record',
  BLACKLISTED: 'Flagged in government records',
  NOC_ISSUED: 'NOC issued — transfer in progress',
  UNKNOWN: 'Records unavailable',
};

export const BLACKLIST_TONES: Record<BlacklistStatus, StatusTone> = {
  CLEAR: 'ok',
  BLACKLISTED: 'err',
  NOC_ISSUED: 'warn',
  UNKNOWN: 'neutral',
};

export const CHALLAN_STATUS_LABELS: Record<ChallanStatus, string> = {
  PAID: 'Paid',
  UNPAID: 'Unpaid',
  DISPOSED: 'Disposed by court',
};

export const REPORT_VERDICT_LABELS: Record<ReportVerdict, string> = {
  CLEAR: 'No issues found',
  ATTENTION: 'Needs attention',
  FLAGGED: 'Flagged',
  UNAVAILABLE: 'Records unavailable',
};

export const REPORT_VERDICT_TONES: Record<ReportVerdict, StatusTone> = {
  CLEAR: 'ok',
  ATTENTION: 'warn',
  FLAGGED: 'err',
  UNAVAILABLE: 'neutral',
};
