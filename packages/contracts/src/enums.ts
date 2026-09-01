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
