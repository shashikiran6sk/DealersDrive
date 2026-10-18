import { z } from 'zod';
import { CursorPage, Uuid } from './common.js';
import { EnquiryStatus, StatusTone } from './enums.js';
import { EnquirySharingPermission } from './legal-inputs.js';

export const EnquiryMessage = z
  .string()
  .trim()
  .max(1000, 'Keep your message under 1,000 characters.')
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

/**
 * `POST /v1/enquiries`.
 *
 * `listingSlug` is the listing's public address — the only identifier a buyer
 * ever sees (F075) — used as a reference, never written. It is not a slug the
 * caller chooses, which is what the package's rule 2 exists to prevent.
 */
export const CreateEnquiryInput = z
  .object({
    listingSlug: z.string().trim().min(1, 'Choose a car to enquire about.').max(200),
    message: EnquiryMessage,
    sharing: EnquirySharingPermission.optional(),
    recipientId: Uuid.optional(),
  })
  .strict();
export type CreateEnquiryInput = z.infer<typeof CreateEnquiryInput>;

/** What the customer is told once the dealership has their enquiry. */
export const EnquiryReceipt = z.object({
  id: z.string(),
  status: EnquiryStatus,
  createdAt: z.string(),
  /** The dealership that received it — the name only, as on the VDP. */
  dealerName: z.string(),
  vehicleTitle: z.string(),
});
export type EnquiryReceipt = z.infer<typeof EnquiryReceipt>;

export const CustomerEnquiryStatus = z.enum(['SENT', 'CONTACTED', 'CLOSED']);
export type CustomerEnquiryStatus = z.infer<typeof CustomerEnquiryStatus>;

export function customerEnquiryStatus(status: EnquiryStatus): CustomerEnquiryStatus {
  if (status === 'NEW') return 'SENT';
  if (status === 'CONTACTED') return 'CONTACTED';
  return 'CLOSED';
}

export const CUSTOMER_ENQUIRY_STATUS_LABELS: Record<CustomerEnquiryStatus, string> = {
  SENT: 'Sent',
  CONTACTED: 'Contacted',
  CLOSED: 'Closed',
};

export const CUSTOMER_ENQUIRY_STATUS_TONES: Record<CustomerEnquiryStatus, StatusTone> = {
  SENT: 'accent',
  CONTACTED: 'ok',
  CLOSED: 'neutral',
};

/** `GET /v1/enquiries` — newest first, cursor-paginated. */
export const CustomerEnquiryQuery = z
  .object({
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type CustomerEnquiryQuery = z.infer<typeof CustomerEnquiryQuery>;

/**
 * One of the customer's enquiries. `vehicle.href` is the car's public page
 * while it is on the marketplace, and null once it is not.
 */
export const CustomerEnquiry = z.object({
  id: Uuid,
  sharingGrantId: Uuid.nullable().optional(),
  sharingWithdrawn: z.boolean().optional(),
  status: CustomerEnquiryStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  message: z.string().nullable(),
  createdAt: z.string(),
  createdLabel: z.string(),
  dealerName: z.string(),
  vehicle: z.object({
    title: z.string(),
    href: z.string().nullable(),
  }),
});
export type CustomerEnquiry = z.infer<typeof CustomerEnquiry>;

export const CustomerEnquiriesResponse = z.object({
  data: z.array(CustomerEnquiry),
  page: CursorPage,
});
export type CustomerEnquiriesResponse = z.infer<typeof CustomerEnquiriesResponse>;
