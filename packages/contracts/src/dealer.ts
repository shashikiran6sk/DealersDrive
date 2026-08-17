import { z } from 'zod';

import { CursorPage, Uuid } from './common.js';
import {
  BodyType,
  CloseReason,
  CreditReason,
  DealerDocType,
  DealerRole,
  DealerStatus,
  DisplayStatus,
  DocStatus,
  EnquirySource,
  EnquiryStatus,
  FuelType,
  InsuranceType,
  InvoiceStatus,
  MediaStatus,
  PriceNegotiability,
  StatusTone,
  Transmission,
} from './enums.js';

/**
 * PART C — the dealer API (API-SPEC C1–C20).
 *
 * Not one schema in this file accepts a `dealerId`, a `status`, or a `slug`.
 * They come from the session and from the state machine respectively, and
 * `.strict()` turns an attempt to send one into a 400 rather than a silent
 * success (ARCHITECTURE §10, CLAUDE.md rules 1 and 5).
 */

// ─────────── B4 session ────────────────────────────────────────────────────
export const SessionResponse = z.object({
  user: z.object({
    id: Uuid,
    fullName: z.string().nullable(),
    roleTitle: z.string().nullable(),
    phone: z.string(),
    phoneDisplay: z.string(),
    email: z.string().nullable(),
    emailVerified: z.boolean(),
  }),
  dealer: z.object({
    id: Uuid,
    slug: z.string(),
    brandName: z.string(),
    status: DealerStatus,
    statusLabel: z.string(),
    isVerified: z.boolean(),
    creditBalance: z.number().int(),
    creditsHeld: z.number().int(),
  }),
  role: DealerRole,
  permissions: z.array(z.string()),
  counts: z.object({ newEnquiries: z.number().int(), pendingListings: z.number().int() }),
});
export type SessionResponse = z.infer<typeof SessionResponse>;

// ─────────── C1/C2 dealer profile ──────────────────────────────────────────
export const DealerProfile = z.object({
  id: Uuid,
  slug: z.string(),
  status: DealerStatus,
  statusLabel: z.string(),
  statusReason: z.string().nullable(),
  brandName: z.string(),
  legalName: z.string(),
  tagline: z.string().nullable(),
  about: z.string().nullable(),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  contact: z.object({
    fullName: z.string().nullable(),
    roleTitle: z.string().nullable(),
    phone: z.string(),
    phoneDisplay: z.string(),
    email: z.string().nullable(),
    landline: z.string().nullable(),
  }),
  address: z.object({
    line: z.string().nullable(),
    cityId: Uuid.nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    pincode: z.string().nullable(),
  }),
  specialities: z.array(z.string()),
  workingHours: z.record(z.string(), z.string().nullable()).nullable(),
  establishedYear: z.number().int().nullable(),
  logoMediaId: Uuid.nullable(),
  coverMediaId: Uuid.nullable(),
  creditBalance: z.number().int(),
  creditsHeld: z.number().int(),
  activeListings: z.number().int(),
  approvedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type DealerProfile = z.infer<typeof DealerProfile>;

const GSTIN = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'GSTIN must be 15 characters.');

const PAN = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must look like AABCS1429P.');

/**
 * Partial by design: each wizard step PATCHes only its own fields, so `Back`
 * never loses data. `phone` is absent — it is the login identity and changing
 * it needs an OTP round-trip on the new number.
 */
export const UpdateDealerInput = z
  .object({
    brandName: z.string().trim().min(2).max(120).optional(),
    legalName: z.string().trim().min(2).max(160).optional(),
    tagline: z.string().trim().max(200).optional(),
    about: z.string().trim().max(4000).optional(),
    gstin: GSTIN.optional(),
    pan: PAN.optional(),
    establishedYear: z.number().int().min(1900).max(2100).optional(),
    specialities: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
    workingHours: z.record(z.string(), z.string().nullable()).optional(),
    contact: z
      .object({
        fullName: z.string().trim().min(2).max(80).optional(),
        roleTitle: z.string().trim().max(60).optional(),
        email: z.string().trim().email().optional(),
        landline: z.string().trim().max(24).optional(),
      })
      .strict()
      .optional(),
    address: z
      .object({
        line: z.string().trim().max(200).optional(),
        cityId: Uuid.optional(),
        state: z.string().trim().max(60).optional(),
        pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits.').optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type UpdateDealerInput = z.infer<typeof UpdateDealerInput>;

// ─────────── C3 completeness ───────────────────────────────────────────────
export const CompletenessResponse = z.object({
  isComplete: z.boolean(),
  canSubmit: z.boolean(),
  percent: z.number().int(),
  steps: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      complete: z.boolean(),
      missing: z.array(z.string()),
    }),
  ),
});
export type CompletenessResponse = z.infer<typeof CompletenessResponse>;

export const DealerSubmitResponse = z.object({
  status: DealerStatus,
  statusLabel: z.string(),
  submittedAt: z.string(),
  expectedDecisionBy: z.string(),
  message: z.string(),
});
export type DealerSubmitResponse = z.infer<typeof DealerSubmitResponse>;

// ─────────── C5 KYC documents ──────────────────────────────────────────────
export const DealerDocumentDto = z.object({
  id: Uuid.nullable(),
  type: DealerDocType,
  label: z.string(),
  status: DocStatus,
  statusLabel: z.string(),
  fileName: z.string().nullable(),
  uploadedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  action: z.string(),
});
export type DealerDocumentDto = z.infer<typeof DealerDocumentDto>;

export const DealerDocumentsResponse = z.object({
  data: z.array(DealerDocumentDto),
  allVerified: z.boolean(),
});
export type DealerDocumentsResponse = z.infer<typeof DealerDocumentsResponse>;

export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

export const DocumentPresignInput = z
  .object({
    type: DealerDocType,
    fileName: z.string().trim().min(1).max(160),
    mimeType: z.enum(DOCUMENT_MIME_TYPES),
    bytes: z.number().int().min(1).max(DOCUMENT_MAX_BYTES),
  })
  .strict();
export type DocumentPresignInput = z.infer<typeof DocumentPresignInput>;

export const PresignResponse = z.object({
  documentId: Uuid.optional(),
  mediaId: Uuid.optional(),
  uploadUrl: z.string(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresInSeconds: z.number().int(),
  maxBytes: z.number().int().optional(),
});
export type PresignResponse = z.infer<typeof PresignResponse>;

export const DocumentCommitInput = z.object({ documentId: Uuid }).strict();
export type DocumentCommitInput = z.infer<typeof DocumentCommitInput>;

export const DocTypeParam = z.object({ type: DealerDocType }).strict();
export type DocTypeParam = z.infer<typeof DocTypeParam>;

// ─────────── C6 inventory ──────────────────────────────────────────────────
export const InventoryQuery = z
  .object({
    status: DisplayStatus.optional(),
    q: z.string().max(120).optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type InventoryQuery = z.infer<typeof InventoryQuery>;

export const InventoryRow = z.object({
  vehicleId: Uuid,
  listingId: Uuid.nullable(),
  title: z.string(),
  thumbnailUrl: z.string().nullable(),
  pricePaise: z.number().int().nullable(),
  priceLabel: z.string(),
  kmLabel: z.string(),
  fuelLabel: z.string(),
  metaLabel: z.string(),
  displayStatus: DisplayStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  views: z.number().int(),
  enquiries: z.number().int(),
  expiresAt: z.string().nullable(),
  expiryLabel: z.string(),
  submittedLabel: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  canEdit: z.boolean(),
  canResubmit: z.boolean(),
  canRenew: z.boolean(),
  canMarkSold: z.boolean(),
  canDelete: z.boolean(),
});
export type InventoryRow = z.infer<typeof InventoryRow>;

export const InventoryResponse = z.object({
  data: z.array(InventoryRow),
  page: CursorPage,
  totalCount: z.number().int(),
  countLabel: z.string(),
  /** null when nothing needs attention. */
  banner: z
    .object({
      type: z.enum(['REJECTED', 'CHANGES_REQUESTED']),
      listingId: Uuid,
      vehicleId: Uuid,
      title: z.string(),
      reason: z.string(),
      actionLabel: z.string(),
      actionHref: z.string(),
    })
    .nullable(),
});
export type InventoryResponse = z.infer<typeof InventoryResponse>;

// ─────────── C7–C9 vehicle write ───────────────────────────────────────────
export const CreateVehicleInput = z
  .object({
    makeId: Uuid,
    modelId: Uuid,
    variantId: Uuid.nullish(),
    year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
    fuel: FuelType,
    transmission: Transmission,
    bodyType: BodyType,
  })
  .strict();
export type CreateVehicleInput = z.infer<typeof CreateVehicleInput>;

export const UpdateVehicleInput = z
  .object({
    makeId: Uuid.optional(),
    modelId: Uuid.optional(),
    variantId: Uuid.nullish(),
    year: z.number().int().min(1950).max(new Date().getFullYear() + 1).optional(),
    fuel: FuelType.optional(),
    transmission: Transmission.optional(),
    bodyType: BodyType.optional(),
    kmDriven: z.number().int().min(0).max(1_000_000).optional(),
    ownerNumber: z.number().int().min(1).max(9).optional(),
    colorId: Uuid.nullish(),
    seats: z.number().int().min(2).max(10).nullish(),
    airbags: z.number().int().min(0).max(12).nullish(),
    rtoCode: z.string().trim().max(8).nullish(),
    cityId: Uuid.optional(),
    regNumberMasked: z.string().trim().max(20).nullish(),
    insuranceType: InsuranceType.nullish(),
    insuranceValidTill: z.string().datetime({ offset: true }).nullish(),
    priceNegotiable: PriceNegotiability.optional(),
    /** Paise. A rupee float would be a bug, not a style choice (rule 3). */
    pricePaise: z.number().int().min(1000).max(500_000_000_00).optional(),
    description: z.string().trim().max(4000).nullish(),
    features: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
  })
  .strict();
export type UpdateVehicleInput = z.infer<typeof UpdateVehicleInput>;

export const CompletenessBlocker = z.object({ code: z.string(), message: z.string() });

export const VehicleCompleteness = z.object({
  percent: z.number().int(),
  missing: z.array(z.string()),
  canSubmit: z.boolean(),
  blockers: z.array(CompletenessBlocker),
});
export type VehicleCompleteness = z.infer<typeof VehicleCompleteness>;

export const VehicleMediaDto = z.object({
  mediaId: Uuid,
  position: z.number().int(),
  isPrimary: z.boolean(),
  status: MediaStatus,
  url: z.string().nullable(),
  blurhash: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  fileName: z.string().nullable(),
  warnings: z.array(z.string()),
  uploadedByAdmin: z.boolean(),
});
export type VehicleMediaDto = z.infer<typeof VehicleMediaDto>;

export const DealerVehicleDto = z.object({
  id: Uuid,
  status: z.enum(['DRAFT', 'READY', 'SOLD', 'ARCHIVED']),
  displayStatus: DisplayStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  slug: z.string().nullable(),
  title: z.string(),
  makeId: Uuid,
  modelId: Uuid,
  variantId: Uuid.nullable(),
  year: z.number().int(),
  fuel: FuelType,
  transmission: Transmission,
  bodyType: BodyType,
  kmDriven: z.number().int().nullable(),
  ownerNumber: z.number().int().nullable(),
  colorId: Uuid.nullable(),
  seats: z.number().int().nullable(),
  airbags: z.number().int().nullable(),
  rtoCode: z.string().nullable(),
  cityId: Uuid.nullable(),
  regNumberMasked: z.string().nullable(),
  insuranceType: InsuranceType.nullable(),
  insuranceValidTill: z.string().nullable(),
  priceNegotiable: PriceNegotiability,
  pricePaise: z.number().int().nullable(),
  priceLabel: z.string(),
  description: z.string().nullable(),
  features: z.array(z.string()),
  photoCount: z.number().int(),
  media: z.array(VehicleMediaDto),
  completeness: VehicleCompleteness,
  /** Drives the wizard's step-4 line "Credits after publish · 22". */
  creditPreview: z.object({
    balance: z.number().int(),
    cost: z.number().int(),
    balanceAfterPublish: z.number().int(),
  }),
  rejectionReason: z.string().nullable(),
  changeRequestNote: z.string().nullable(),
});
export type DealerVehicleDto = z.infer<typeof DealerVehicleDto>;

// ─────────── C11–C13 listing lifecycle ─────────────────────────────────────
export const SubmitListingResponse = z.object({
  listingId: Uuid,
  status: z.literal('PENDING_REVIEW'),
  displayStatus: z.literal('PENDING'),
  statusLabel: z.string(),
  submittedAt: z.string(),
  expectedReviewBy: z.string(),
  credit: z.object({
    held: z.number().int(),
    balanceBefore: z.number().int(),
    balanceAfter: z.number().int(),
    transactionId: Uuid,
    note: z.string(),
  }),
  message: z.string(),
});
export type SubmitListingResponse = z.infer<typeof SubmitListingResponse>;

export const MarkSoldInput = z
  .object({
    soldPricePaise: z.number().int().min(1000).max(500_000_000_00).optional(),
    soldAt: z.string().optional(),
  })
  .strict();
export type MarkSoldInput = z.infer<typeof MarkSoldInput>;

export const MarkSoldResponse = z.object({
  displayStatus: z.literal('SOLD'),
  statusLabel: z.string(),
  removedFromCatalogueAt: z.string(),
});
export type MarkSoldResponse = z.infer<typeof MarkSoldResponse>;

export const RenewListingResponse = z.object({
  listingId: Uuid,
  status: z.literal('PENDING_REVIEW'),
  displayStatus: z.literal('PENDING'),
  renewedFromId: Uuid,
  credit: z.object({
    held: z.number().int(),
    balanceBefore: z.number().int(),
    balanceAfter: z.number().int(),
  }),
  message: z.string(),
});
export type RenewListingResponse = z.infer<typeof RenewListingResponse>;

// ─────────── C14 media ─────────────────────────────────────────────────────
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const MediaPresignInput = z
  .object({
    ownerType: z.enum(['VEHICLE', 'DEALER_LOGO', 'DEALER_COVER']),
    ownerId: Uuid,
    fileName: z.string().trim().min(1).max(160),
    mimeType: z.enum(IMAGE_MIME_TYPES),
    bytes: z.number().int().min(1).max(IMAGE_MAX_BYTES),
    width: z.number().int().min(1).max(20000).optional(),
    height: z.number().int().min(1).max(20000).optional(),
  })
  .strict();
export type MediaPresignInput = z.infer<typeof MediaPresignInput>;

export const MediaCommitInput = z
  .object({ position: z.number().int().min(0).max(40).optional() })
  .strict();
export type MediaCommitInput = z.infer<typeof MediaCommitInput>;

export const MediaCommitResponse = z.object({
  mediaId: Uuid,
  status: MediaStatus,
  position: z.number().int(),
  poll: z.string(),
  estimatedSeconds: z.number().int(),
});
export type MediaCommitResponse = z.infer<typeof MediaCommitResponse>;

/** The full ordered array, always. Never a partial swap (§12.2). */
export const ReorderMediaInput = z
  .object({ mediaIds: z.array(Uuid).min(1).max(40) })
  .strict();
export type ReorderMediaInput = z.infer<typeof ReorderMediaInput>;

// ─────────── C15–C17 enquiries ─────────────────────────────────────────────
export const EnquiryQuery = z
  .object({
    status: EnquiryStatus.optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type EnquiryQuery = z.infer<typeof EnquiryQuery>;

export const EnquiryDto = z.object({
  id: Uuid,
  reference: z.string(),
  name: z.string(),
  initials: z.string(),
  phone: z.string(),
  phoneDisplay: z.string(),
  callHref: z.string(),
  email: z.string().nullable(),
  emailHref: z.string().nullable(),
  message: z.string().nullable(),
  /** null renders the card without the "On <vehicle>" line — a portfolio lead. */
  vehicle: z.object({ id: Uuid, title: z.string(), href: z.string() }).nullable(),
  source: EnquirySource,
  sourceLabel: z.string(),
  status: EnquiryStatus,
  createdAt: z.string(),
  timeAgoLabel: z.string(),
  actions: z.array(z.string()),
});
export type EnquiryDto = z.infer<typeof EnquiryDto>;

export const EnquiryListResponse = z.object({
  data: z.array(EnquiryDto),
  page: CursorPage,
});
export type EnquiryListResponse = z.infer<typeof EnquiryListResponse>;

export const EnquiryCountsResponse = z.object({
  tabs: z.array(
    z.object({ status: EnquiryStatus, label: z.string(), count: z.number().int() }),
  ),
  total: z.number().int(),
});
export type EnquiryCountsResponse = z.infer<typeof EnquiryCountsResponse>;

export const UpdateEnquiryInput = z
  .object({
    status: EnquiryStatus,
    closeReason: CloseReason.optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export type UpdateEnquiryInput = z.infer<typeof UpdateEnquiryInput>;

export const UpdateEnquiryResponse = z.object({
  id: Uuid,
  status: EnquiryStatus,
  contactedAt: z.string().nullable(),
  counts: z.record(EnquiryStatus, z.number().int()),
});
export type UpdateEnquiryResponse = z.infer<typeof UpdateEnquiryResponse>;

// ─────────── C18 dashboard ─────────────────────────────────────────────────
export const DashboardResponse = z.object({
  greeting: z.string(),
  subline: z.string(),
  stats: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.number().int(),
      valueLabel: z.string(),
      delta: z.string(),
      deltaTone: StatusTone,
    }),
  ),
  viewsChart: z.object({
    title: z.string(),
    totalLabel: z.string(),
    max: z.number().int(),
    /** heightPct is server-computed so the chart cannot disagree with the numbers. */
    series: z.array(
      z.object({
        day: z.string(),
        date: z.string(),
        views: z.number().int(),
        heightPct: z.number().int(),
      }),
    ),
  }),
  recentEnquiries: z.array(
    z.object({
      id: Uuid,
      initials: z.string(),
      name: z.string(),
      vehicleTitle: z.string().nullable(),
      phoneDisplay: z.string(),
      callHref: z.string(),
      timeAgoLabel: z.string(),
    }),
  ),
  creditBalance: z.number().int(),
  creditsHeld: z.number().int(),
  alerts: z.array(
    z.object({
      type: z.string(),
      count: z.number().int(),
      message: z.string(),
      href: z.string(),
    }),
  ),
});
export type DashboardResponse = z.infer<typeof DashboardResponse>;

// ─────────── C19 billing ───────────────────────────────────────────────────
export const BillingSummary = z.object({
  creditBalance: z.number().int(),
  creditsHeld: z.number().int(),
  creditsAvailable: z.number().int(),
  label: z.string(),
  note: z.string(),
  listingDurationDays: z.number().int(),
  usedThisMonth: z.number().int(),
});
export type BillingSummary = z.infer<typeof BillingSummary>;

export const CreditPackDto = z.object({
  id: Uuid,
  slug: z.string(),
  credits: z.number().int(),
  pricePaise: z.number().int(),
  priceLabel: z.string(),
  /** Derived by division, never stored — a stored rate that disagrees is a ticket. */
  perListingLabel: z.string(),
  badge: z.string().nullable(),
  highlighted: z.boolean(),
});
export type CreditPackDto = z.infer<typeof CreditPackDto>;

export const CreditPacksResponse = z.object({
  data: z.array(CreditPackDto),
  currency: z.literal('INR'),
  taxNote: z.string(),
});
export type CreditPacksResponse = z.infer<typeof CreditPacksResponse>;

/** The client never sends an amount. The server prices the pack (§26.4). */
export const CreateOrderInput = z.object({ packId: Uuid }).strict();
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;

export const CreateOrderResponse = z.object({
  orderId: Uuid,
  gatewayOrderId: z.string(),
  gateway: z.string(),
  credits: z.number().int(),
  amountPaise: z.number().int(),
  taxPaise: z.number().int(),
  totalPaise: z.number().int(),
  totalLabel: z.string(),
  currency: z.literal('INR'),
  prefill: z.object({ name: z.string(), email: z.string().nullable(), contact: z.string() }),
  expiresAt: z.string(),
  /** True when the active provider settles without a redirect (development). */
  autoCaptured: z.boolean(),
});
export type CreateOrderResponse = z.infer<typeof CreateOrderResponse>;

export const VerifyOrderInput = z
  .object({
    paymentId: z.string().max(120).optional(),
    gatewayOrderId: z.string().max(120).optional(),
    signature: z.string().max(400).optional(),
  })
  .strict();
export type VerifyOrderInput = z.infer<typeof VerifyOrderInput>;

export const VerifyOrderResponse = z.object({
  verified: z.boolean(),
  orderStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED']),
  creditsAdded: z.number().int(),
  creditBalance: z.number().int(),
  invoice: z.object({ id: Uuid, number: z.string() }).nullable(),
  pollAfterSeconds: z.number().int().optional(),
  message: z.string(),
});
export type VerifyOrderResponse = z.infer<typeof VerifyOrderResponse>;

export const LedgerRow = z.object({
  id: Uuid,
  delta: z.number().int(),
  deltaLabel: z.string(),
  tone: StatusTone,
  label: z.string(),
  reason: CreditReason,
  createdAt: z.string(),
  dateLabel: z.string(),
  balanceAfter: z.number().int(),
  balanceLabel: z.string(),
  listingId: Uuid.nullable(),
  orderId: Uuid.nullable(),
  invoiceNumber: z.string().nullable(),
});
export type LedgerRow = z.infer<typeof LedgerRow>;

export const LedgerResponse = z.object({ data: z.array(LedgerRow), page: CursorPage });
export type LedgerResponse = z.infer<typeof LedgerResponse>;

export const InvoiceRow = z.object({
  id: Uuid,
  number: z.string(),
  issuedAt: z.string(),
  dateLabel: z.string(),
  totalPaise: z.number().int(),
  amountLabel: z.string(),
  status: InvoiceStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  credits: z.number().int(),
  pdfUrl: z.string().nullable(),
  pdfReady: z.boolean(),
  failureReason: z.string().nullable(),
});
export type InvoiceRow = z.infer<typeof InvoiceRow>;

export const InvoicesResponse = z.object({ data: z.array(InvoiceRow), page: CursorPage });
export type InvoicesResponse = z.infer<typeof InvoicesResponse>;

// ─────────── C20 photo requests 🟡 ─────────────────────────────────────────
export const CreatePhotoRequestInput = z
  .object({
    vehicleId: Uuid.nullish(),
    vehicleCount: z.number().int().min(1).max(50),
    address: z.string().trim().min(5).max(300),
    contactName: z.string().trim().min(2).max(80),
    contactPhone: z.string().trim().regex(/^(\+?91[- ]?)?[6-9]\d{9}$/),
    preferredDate: z.string().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();
export type CreatePhotoRequestInput = z.infer<typeof CreatePhotoRequestInput>;
