import { z } from 'zod';

import { CursorPage, Uuid } from './common.js';
import { VehicleReportDto } from './dealer.js';
import {
  AdminRole,
  DealerStatus,
  DisplayStatus,
  DocStatus,
  DealerDocType,
  InvoiceStatus,
  ListingStatus,
  PaymentStatus,
  StatusTone,
} from './enums.js';

/**
 * PART D — the admin API (API-SPEC D1–D17). Every write here is audit-logged
 * with the admin's identity, and every cross-tenant read is a deliberate,
 * auditable choice rather than an accident (ARCHITECTURE §7).
 */

// ─────────── D1 metrics ────────────────────────────────────────────────────
export const AdminOverview = z.object({
  stats: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.number().int(),
      valueLabel: z.string(),
      href: z.string().optional(),
    }),
  ),
  moderationQueue: z.object({
    pendingCount: z.number().int(),
    oldestWaitingLabel: z.string(),
    message: z.string(),
    href: z.string(),
  }),
  headerBadge: z.object({
    count: z.number().int(),
    label: z.string(),
    tone: StatusTone,
  }),
  /**
   * Who is signed in, for the console's top bar (DESIGN-SPEC §3.17). It comes
   * from the session, so the header cannot show one operator while the audit
   * log records another.
   */
  operator: z.object({ email: z.string(), adminRole: AdminRole }),
});
export type AdminOverview = z.infer<typeof AdminOverview>;

// ─────────── D2/D3 dealers ─────────────────────────────────────────────────
export const AdminDealerQuery = z
  .object({
    status: DealerStatus.optional(),
    city: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    q: z.string().max(120).optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type AdminDealerQuery = z.infer<typeof AdminDealerQuery>;

export const AdminDealerRow = z.object({
  id: Uuid,
  slug: z.string(),
  brandName: z.string(),
  initials: z.string(),
  city: z.string(),
  status: DealerStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  vehicleCount: z.number().int(),
  activeCount: z.number().int(),
  joinedAt: z.string(),
  joinedLabel: z.string(),
  creditBalance: z.number().int(),
  documentsVerified: z.boolean(),
});
export type AdminDealerRow = z.infer<typeof AdminDealerRow>;

export const AdminDealersResponse = z.object({
  data: z.array(AdminDealerRow),
  page: CursorPage,
  counts: z.record(z.string(), z.number().int()),
});
export type AdminDealersResponse = z.infer<typeof AdminDealersResponse>;

export const AdminDealerDocument = z.object({
  id: Uuid,
  type: DealerDocType,
  label: z.string(),
  status: DocStatus,
  fileName: z.string().nullable(),
  bytes: z.number().int().nullable(),
  uploadedAt: z.string().nullable(),
  /** Short-lived, audit-logged, and the only way a document is ever read. */
  viewUrl: z.string().nullable(),
  viewUrlExpiresAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
});
export type AdminDealerDocument = z.infer<typeof AdminDealerDocument>;

export const AdminDealerDetail = z.object({
  id: Uuid,
  slug: z.string(),
  brandName: z.string(),
  legalName: z.string(),
  initials: z.string(),
  status: DealerStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  statusReason: z.string().nullable(),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  city: z.string().nullable(),
  addressLine: z.string().nullable(),
  contactName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactPhoneDisplay: z.string().nullable(),
  contactEmail: z.string().nullable(),
  joinedLabel: z.string(),
  creditBalance: z.number().int(),
  creditsHeld: z.number().int(),
  counts: z.object({
    vehicles: z.number().int(),
    active: z.number().int(),
    pending: z.number().int(),
    enquiries: z.number().int(),
  }),
  documents: z.array(AdminDealerDocument),
  allDocumentsVerified: z.boolean(),
  recentLedger: z.array(
    z.object({
      id: Uuid,
      delta: z.number().int(),
      deltaLabel: z.string(),
      label: z.string(),
      dateLabel: z.string(),
      balanceAfter: z.number().int(),
    }),
  ),
  actions: z.object({
    canApprove: z.boolean(),
    canReject: z.boolean(),
    canSuspend: z.boolean(),
    canReinstate: z.boolean(),
    canGrantCredits: z.boolean(),
  }),
});
export type AdminDealerDetail = z.infer<typeof AdminDealerDetail>;

export const ApproveDealerInput = z
  .object({
    grantCredits: z.number().int().min(0).max(1000).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .strict();
export type ApproveDealerInput = z.infer<typeof ApproveDealerInput>;

/** Six characters is what the dialog's disabled confirm button implies (§10). */
export const ReasonInput = z
  .object({ reason: z.string().trim().min(6, 'Give a reason of at least 6 characters.').max(500) })
  .strict();
export type ReasonInput = z.infer<typeof ReasonInput>;

export const NoteInput = z.object({ note: z.string().trim().max(500).optional() }).strict();
export type NoteInput = z.infer<typeof NoteInput>;

export const DealerModerationResponse = z.object({
  id: Uuid,
  status: DealerStatus,
  statusLabel: z.string(),
  creditsGranted: z.number().int(),
  creditBalance: z.number().int(),
  listingsAffected: z.number().int(),
  notifiedAt: z.string(),
});
export type DealerModerationResponse = z.infer<typeof DealerModerationResponse>;

export const GrantCreditsInput = z
  .object({
    credits: z
      .number()
      .int()
      .refine((n) => n !== 0, 'Grant a non-zero number of credits.'),
    label: z.string().trim().min(3).max(120),
    reason: z.string().trim().max(300).optional(),
  })
  .strict()
  .refine((v) => v.credits > 0 || (v.reason?.length ?? 0) >= 6, {
    message: 'A negative adjustment needs a reason.',
    path: ['reason'],
  });
export type GrantCreditsInput = z.infer<typeof GrantCreditsInput>;

export const GrantCreditsResponse = z.object({
  transactionId: Uuid,
  delta: z.number().int(),
  balanceAfter: z.number().int(),
  dealerNotified: z.boolean(),
});
export type GrantCreditsResponse = z.infer<typeof GrantCreditsResponse>;

export const VerifyDocumentResponse = z.object({
  status: DocStatus,
  allVerified: z.boolean(),
  dealerCanBeApproved: z.boolean(),
});
export type VerifyDocumentResponse = z.infer<typeof VerifyDocumentResponse>;

// ─────────── D7/D8 moderation ──────────────────────────────────────────────
export const AdminListingQuery = z
  .object({
    status: ListingStatus.default('PENDING_REVIEW'),
    dealer: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    city: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type AdminListingQuery = z.infer<typeof AdminListingQuery>;

/** Advisory only. A flag never auto-rejects anything (§10). */
export const ModerationFlag = z.object({
  code: z.enum([
    'TOO_FEW_PHOTOS',
    'PRICE_OUT_OF_BAND',
    'CONTACT_IN_DESCRIPTION',
    'IMPLAUSIBLE_KM',
    'DUPLICATE_IMAGE_HASH',
  ]),
  severity: z.enum(['warn', 'err']),
  message: z.string(),
});
export type ModerationFlag = z.infer<typeof ModerationFlag>;

export const ModerationRow = z.object({
  listingId: Uuid,
  vehicleId: Uuid,
  title: z.string(),
  thumbnailUrl: z.string().nullable(),
  dealer: z.object({ slug: z.string(), brandName: z.string(), isVerified: z.boolean() }),
  pricePaise: z.number().int(),
  priceLabel: z.string(),
  city: z.string(),
  kmLabel: z.string(),
  fuelLabel: z.string(),
  transmissionLabel: z.string(),
  photoCount: z.number().int(),
  submittedAt: z.string(),
  submittedLabel: z.string(),
  flags: z.array(ModerationFlag),
});
export type ModerationRow = z.infer<typeof ModerationRow>;

export const ModerationQueueResponse = z.object({
  data: z.array(ModerationRow),
  page: CursorPage,
  pendingCount: z.number().int(),
  oldestWaitingLabel: z.string(),
});
export type ModerationQueueResponse = z.infer<typeof ModerationQueueResponse>;

export const AdminListingDetail = z.object({
  listingId: Uuid,
  vehicleId: Uuid,
  status: ListingStatus,
  displayStatus: DisplayStatus,
  title: z.string(),
  priceLabel: z.string(),
  metaLabel: z.string(),
  dealer: z.object({
    id: Uuid,
    slug: z.string(),
    brandName: z.string(),
    status: DealerStatus,
    isVerified: z.boolean(),
    creditBalance: z.number().int(),
    href: z.string(),
  }),
  photos: z.array(
    z.object({ id: Uuid, position: z.number().int(), label: z.string(), url: z.string() }),
  ),
  photoCount: z.number().int(),
  photoCountLabel: z.string(),
  specs: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() })),
  description: z.string().nullable(),
  flags: z.array(ModerationFlag),
  credit: z.object({
    held: z.boolean(),
    transactionId: Uuid.nullable(),
    dealerBalance: z.number().int(),
  }),
  actions: z.object({
    canApprove: z.boolean(),
    canReject: z.boolean(),
    canRequestChanges: z.boolean(),
    canTakedown: z.boolean(),
    consequenceNote: z.string(),
  }),
  rejectionReasonPresets: z.array(z.string()),
  /**
   * The full records check — the same itemised view the dealer sees, not the
   * buyer's summary. A moderator approving a listing is the last human between
   * a flagged vehicle and the public marketplace, so they get everything.
   *
   * Null when `feature.vehicleReport` is off or the vehicle was never looked
   * up. A null report is not a clean one, and the review screen says so.
   */
  report: VehicleReportDto.nullable(),
  /**
   * True when a blacklist blocker was overridden to let this listing through.
   * The override is audit-logged; this flag is what makes it visible on the
   * screen afterwards rather than only in the log.
   */
  blacklistOverridden: z.boolean(),
});
export type AdminListingDetail = z.infer<typeof AdminListingDetail>;

export const ApproveListingResponse = z.object({
  listingId: Uuid,
  status: z.literal('APPROVED'),
  displayStatus: z.literal('ACTIVE'),
  approvedAt: z.string(),
  expiresAt: z.string(),
  expiryLabel: z.string(),
  credit: z.object({
    consumed: z.number().int(),
    transactionId: Uuid,
    dealerBalanceAfter: z.number().int(),
  }),
  publicUrl: z.string(),
  toast: z.string(),
});
export type ApproveListingResponse = z.infer<typeof ApproveListingResponse>;

export const RejectListingResponse = z.object({
  listingId: Uuid,
  status: z.literal('REJECTED'),
  displayStatus: z.literal('REJECTED'),
  reason: z.string(),
  credit: z.object({
    released: z.number().int(),
    transactionId: Uuid.nullable(),
    dealerBalanceAfter: z.number().int(),
  }),
  dealerNotifiedAt: z.string(),
  toast: z.string(),
});
export type RejectListingResponse = z.infer<typeof RejectListingResponse>;

export const RequestChangesInput = z
  .object({ note: z.string().trim().min(6, 'Give a note of at least 6 characters.').max(500) })
  .strict();
export type RequestChangesInput = z.infer<typeof RequestChangesInput>;

export const RequestChangesResponse = z.object({
  listingId: Uuid,
  status: z.literal('CHANGES_REQUESTED'),
  displayStatus: z.literal('CHANGES_REQUESTED'),
  note: z.string(),
  /** The credit stays held. This is the difference from rejection. */
  credit: z.object({ stillHeld: z.number().int(), dealerBalanceAfter: z.number().int() }),
  dealerNotifiedAt: z.string(),
  toast: z.string(),
});
export type RequestChangesResponse = z.infer<typeof RequestChangesResponse>;

export const TakedownInput = z
  .object({
    reason: z.string().trim().min(6).max(500),
    refundCredit: z.boolean().default(false),
  })
  .strict();
export type TakedownInput = z.infer<typeof TakedownInput>;

export const TakedownResponse = z.object({
  status: z.literal('REMOVED'),
  removedFromCatalogueAt: z.string(),
  creditRefunded: z.boolean(),
});
export type TakedownResponse = z.infer<typeof TakedownResponse>;

// ─────────── D13 payments ──────────────────────────────────────────────────
export const AdminPaymentQuery = z
  .object({
    status: PaymentStatus.optional(),
    dealer: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type AdminPaymentQuery = z.infer<typeof AdminPaymentQuery>;

export const AdminPaymentRow = z.object({
  id: Uuid,
  gatewayPaymentId: z.string(),
  dealer: z.object({ slug: z.string(), brandName: z.string() }),
  invoiceNumber: z.string().nullable(),
  credits: z.number().int(),
  amountPaise: z.number().int(),
  amountLabel: z.string(),
  method: z.string().nullable(),
  status: PaymentStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  capturedAt: z.string().nullable(),
  dateLabel: z.string(),
});
export type AdminPaymentRow = z.infer<typeof AdminPaymentRow>;

export const AdminPaymentsResponse = z.object({
  data: z.array(AdminPaymentRow),
  page: CursorPage,
  /** gross = captured; net = recognised after 18% GST. Different on purpose. */
  totals: z.object({
    grossPaise: z.number().int(),
    grossLabel: z.string(),
    netPaise: z.number().int(),
    netLabel: z.string(),
    taxPaise: z.number().int(),
    taxLabel: z.string(),
    count: z.number().int(),
    periodLabel: z.string(),
  }),
});
export type AdminPaymentsResponse = z.infer<typeof AdminPaymentsResponse>;

export const InvoiceStatusRef = InvoiceStatus;

// ─────────── D14 config ────────────────────────────────────────────────────
export const ConfigEntry = z.object({
  key: z.string(),
  value: z.union([z.number(), z.boolean(), z.string(), z.array(z.string())]),
  type: z.enum(['number', 'boolean', 'string', 'string[]']),
  label: z.string(),
  updatedAt: z.string().nullable(),
});
export type ConfigEntry = z.infer<typeof ConfigEntry>;

export const ConfigResponse = z.object({ data: z.array(ConfigEntry) });
export type ConfigResponse = z.infer<typeof ConfigResponse>;

export const UpdateConfigInput = z
  .object({
    value: z.union([z.number(), z.boolean(), z.string(), z.array(z.string())]),
  })
  .strict();
export type UpdateConfigInput = z.infer<typeof UpdateConfigInput>;

export const ConfigKeyParam = z.object({ key: z.string().min(1).max(80) }).strict();
export type ConfigKeyParam = z.infer<typeof ConfigKeyParam>;

// ─────────── D15 audit ─────────────────────────────────────────────────────
export const AuditQuery = z
  .object({
    entityType: z.string().max(60).optional(),
    entityId: z.string().max(80).optional(),
    dealerId: Uuid.optional(),
    actorId: Uuid.optional(),
    action: z.string().max(60).optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type AuditQuery = z.infer<typeof AuditQuery>;

export const AuditRow = z.object({
  id: z.string(),
  actorType: z.string(),
  actor: z.object({ id: z.string().nullable(), email: z.string().nullable() }),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  dealerId: z.string().nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  ip: z.string().nullable(),
  traceId: z.string().nullable(),
  createdAt: z.string(),
  dateLabel: z.string(),
});
export type AuditRow = z.infer<typeof AuditRow>;

export const AuditResponse = z.object({ data: z.array(AuditRow), page: CursorPage });
export type AuditResponse = z.infer<typeof AuditResponse>;
