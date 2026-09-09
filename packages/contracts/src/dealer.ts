import { z } from 'zod';

import { GoogleMapsUrl, IndianMobile, MapKind, Uuid } from './common.js';
import { DealerDocType, DealerStatus, DocStatus, MediaStatus } from './enums.js';

/**
 * PART C — the dealer console (API-SPEC C1–C20). Every shape here is read or
 * written by somebody holding a `DealerPrincipal`, which is why not one of them
 * names a `dealerId`: that comes from the session (CLAUDE.md rule 1).
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is ~800 lines covering the dealership profile, onboarding,
 * KYC documents, the vehicle wizard, RC lookup, inventory, media and enquiries.
 * Each shape arrives with the feature that first sends or answers with it; the
 * C14 media block below is here because **F033** is, the C5 KYC read shapes
 * because **F040** is, and C1/C2 plus the C5 write shapes because **F041** is.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Shared by the two presign paths — C14 media (**F033**) and the KYC document
 * upload (**F041**) — which is why both id fields are optional. One schema
 * rather than two, so the response shape a client parses cannot drift between
 * them.
 */
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
    city: z.string().nullable(),
    /** Nullable for the rows that predate onboarding asking for it. */
    district: z.string().nullable(),
    state: z.string().nullable(),
    pincode: z.string().nullable(),
    /**
     * The dealer's own Google Maps link, verbatim. The public portfolio's "Get
     * directions" is an anchor to this and nothing else — nullable for the
     * rows that predate the question, which is what the portfolio branches on.
     */
    mapsUrl: z.string().nullable(),
    /**
     * What that link is actually worth as a map (**R20**) — the place card, a
     * bare pin, or nothing. `NONE` covers both "no link" and "a link we could
     * not read a position out of"; `mapsUrl` is what tells the two apart.
     *
     * On this screen and not on the public one: a buyer looks at the map, and a
     * dealer looks at a box with a URL in it. See `MapKind`.
     */
    mapKind: MapKind,
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
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    'GSTIN must be 15 characters.',
  );

const PAN = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must look like AABCS1429P.');

/**
 * Partial by design: each wizard step PATCHes only its own fields, so `Back`
 * never loses data.
 *
 * `contact.phone` **is** patchable, and its absence used to be justified by a
 * sentence that is no longer true: "it is the login identity, and changing it
 * needs an OTP round-trip on the new number". Identity is a Google account —
 * `sub` first, address second — and has been since dealers stopped signing in
 * with a number. What this field holds is the number a *buyer* is given, which
 * is precisely the thing a dealership changes when it swaps SIMs, and a
 * read-only box on the step that asks for it was a dead end with no other way
 * out. It stays unique across users, so the swap is still refused when the
 * number belongs to somebody else.
 */
export const UpdateDealerInput = z
  .object({
    /**
     * The dealership's registered name, and the only name it has. `brandName`
     * is absent from this schema deliberately: it is the server-written display
     * mirror of `legalName`, and a client able to set the two independently is
     * a client able to make them disagree.
     */
    legalName: z.string().trim().min(2).max(160).optional(),
    /**
     * Optional here because this schema is a partial patch — a step that does
     * not carry the line must not be read as clearing it. But it may not be
     * *emptied*: the same 10-character floor `OnboardingInput` applies holds
     * when the field is present (**R26**), so a dealer cannot delete on the
     * profile screen what onboarding insisted on, and neither can a moderator
     * clearing the box on the review screen.
     */
    tagline: z
      .string()
      .trim()
      .min(10, 'One line buyers will read under your name.')
      .max(200, 'Keep it to one line — 200 characters at most.')
      .optional(),
    /**
     * The paragraph the portfolio used to open with.
     *
     * ── Deliberate divergence, R25/R26 ──────────────────────────
     * Nothing asks for this any more and nothing public renders it. **R25**
     * took it off the portfolio, where the tagline replaced it; **R26** took
     * it off onboarding and off the dealer's own profile screen.
     *
     * It stays in this schema, and the column stays in the database, for one
     * reason: every dealership on the platform has written into it, and the
     * admin console still shows it to a reviewer — `updateDealerAction` parses
     * against this same schema, so removing the field here would make that box
     * unsavable. It is history a moderator can read and correct, not a field
     * the product collects.
     *
     * The floor stays at 20 for the rows that have one. A moderator clearing
     * the box would be deleting a dealership's own words, and there is no
     * screen on which that is the intended gesture.
     * ─────────────────────────────────────────────────────────────────────────
     */
    about: z
      .string()
      .trim()
      .min(20, 'Tell buyers about your dealership \u2014 a sentence or two.')
      .max(4000)
      .optional(),
    gstin: GSTIN.optional(),
    pan: PAN.optional(),
    establishedYear: z.number().int().min(1900).max(2100).optional(),
    /**
     * The same floor of one that `OnboardingInput` applies (**R26**): present
     * and empty is a dealer clearing on the profile screen what the sign-up
     * form would not let them skip. Absent is untouched, as everywhere in this
     * partial patch.
     *
     * And the same three sentences, word for word (**R30**). The dealer's
     * profile screen validates against *this* schema and the sign-up wizard
     * against `OnboardingInput`, so a bound with a message on one side and
     * Zod's default on the other is one field answering a dealer in two
     * different voices depending on which screen they were standing on.
     */
    specialities: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(60, 'Keep each service to a short label — 60 characters at most.'),
      )
      .min(1, 'Name at least one service you offer.')
      .max(12, 'Twelve services at most — list the ones buyers ask for.')
      .optional(),
    workingHours: z.record(z.string(), z.string().nullable()).optional(),
    contact: z
      .object({
        fullName: z.string().trim().min(2).max(80).optional(),
        roleTitle: z.string().trim().max(60).optional(),
        email: z.string().trim().email().optional(),
        /** The same rule the onboarding form applies, from the same schema. */
        phone: IndianMobile.optional(),
        landline: z.string().trim().max(24).optional(),
      })
      .strict()
      .optional(),
    address: z
      .object({
        line: z.string().trim().max(200).optional(),
        /**
         * Locality as free text, not as a foreign key.
         *
         * ── Deliberate divergence from the baseline ───────────────────────
         * The baseline resolved a `citySlug` against a five-row `cities`
         * table, and took the dealership's coordinates off the row it found.
         * That made the reach of the product a database migration: a dealer in
         * Salem could not complete this form, and a dealer in Bengaluru could
         * not be described by it at all, because `state` was whatever the
         * catalogue said rather than where the yard is.
         *
         * So the table is gone and both are typed. The cost is that
         * `lat`/`lng` are no longer set here — a city row carried them, a
         * string cannot — and geocoding is a separate concern with its own
         * feature. Nothing reads those columns yet; the distance sort that
         * will arrives with search.
         * ──────────────────────────────────────────────────────────────────
         */
        city: z.string().trim().min(2).max(80).optional(),
        /** Free text and normalised on write, exactly like `city` and `state`. */
        district: z.string().trim().min(2).max(80).optional(),
        state: z.string().trim().min(2).max(80).optional(),
        pincode: z
          .string()
          .trim()
          .regex(/^\d{6}$/, 'Pincode must be 6 digits.')
          .optional(),
        /** The Google Maps link. Host-checked — see `GoogleMapsUrl`. */
        mapsUrl: GoogleMapsUrl.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type UpdateDealerInput = z.infer<typeof UpdateDealerInput>;

/**
 * What a dealer may change about their own dealership after onboarding is over
 * (**R27**) — and, by omission, everything they may not.
 *
 * ## Why this is a second schema rather than a check
 *
 * `UpdateDealerInput` is what an *admin* may write, and it is the right shape
 * for that: a moderator with the certificate in hand corrects a misspelt town
 * or a GSTIN typed a digit wrong. It was also, until now, the shape
 * `PATCH /v1/dealer` accepted — so the dealership's own name, the address, the
 * town, the pin and the contact number were all editable from the profile
 * screen, by the dealer, silently, at any hour.
 *
 * Three of those are load-bearing in ways the screen does not admit to:
 *
 *   · **The registered name** is what KYC was checked against, and what the
 *     slug and the public URL are derived from.
 *   · **The address, town and pin** are what the yard photograph and the
 *     verification visit were about. A dealership that edits them is not
 *     correcting a record; it is a different dealership at a different place,
 *     verified on evidence that no longer describes it.
 *   · **The mobile and the email** are how a buyer and the platform reach a
 *     business that has been vouched for.
 *
 * A dealership that has genuinely moved closes this account and opens another.
 * That is a heavier answer than an edit box, and it is the correct one: the
 * VERIFIED plate is a claim about a place, and there is no way to carry it
 * across a move without checking the new place.
 *
 * So the rule is written as a **type** rather than as a guard in a service.
 * `.strict()` means a profile save that carries `legalName` is a 400 that names
 * the field, not a silent success — and a reviewer can see the whole of the
 * dealer's own authority by reading these three lines. A runtime `if` over
 * `UpdateDealerInput` would be the same rule stated where it is easy to lose.
 *
 * ## What is still theirs
 *
 * The three answers that are opinions rather than evidence, and that no
 * verification rests on: when they started trading, the line they describe
 * themselves in (R25/R26), and what their yard does. Every one of them is
 * published, none of them can be used to become a different business, and all
 * three are exactly what a dealership wants to keep current.
 *
 * GSTIN and PAN are absent here too, and they were absent from the *screen*
 * long before they were absent from the schema — the form has always rendered
 * them `disabled` under a note saying to contact support. That note is now
 * true at the API as well.
 *
 * ⚠️ The onboarding wizard still needs the full shape: a DRAFT dealership is
 * one that is still answering these questions, or has been sent back to fix
 * one. It uses `PATCH /v1/dealer/onboarding`, which takes `UpdateDealerInput`
 * and refuses anything that is not DRAFT.
 */
export const DealerSelfUpdateInput = UpdateDealerInput.pick({
  establishedYear: true,
  tagline: true,
  specialities: true,
}).strict();
export type DealerSelfUpdateInput = z.infer<typeof DealerSelfUpdateInput>;

// ─────────── C3 completeness ───────────────────────────────────────────────
/**
 * The single derived answer to "what is still missing".
 *
 * It is derived once, on the server, and read by two callers that must agree:
 * the wizard, which uses it to say what is outstanding, and
 * `POST /v1/dealer/submit`, which uses the same condition to refuse a premature
 * submit. Two independent derivations would eventually disagree, and the
 * disagreement would be about whether a dealer is allowed to trade.
 *
 * `missing` carries field keys — `gstin`, `GST_CERTIFICATE` — which are precise
 * and not something to put in front of somebody at the end of a sign-up form.
 * The wizard maps them to words.
 */
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
/**
 * One row of the KYC checklist.
 *
 * `id` is nullable and `status` defaults to `REQUIRED`, because the response
 * describes **all three document types whether or not a row exists** — a
 * checklist that grew as documents were uploaded would read as "not required"
 * for the ones still missing.
 *
 * `statusLabel` and `action` are derived server-side rather than in the client.
 * Two clients deriving them independently would eventually disagree about what
 * a dealer is being asked to do next.
 */
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

/**
 * The upload rules, in one place because both ends enforce them: the browser
 * checks them for the message, the presign signature bakes them in for real.
 *
 * 5 MB, and PDF, JPEG or PNG. A KYC document is a scan or a photo of a
 * certificate — anything larger is a misunderstanding rather than a need.
 */
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

export const DocumentCommitInput = z.object({ documentId: Uuid }).strict();
export type DocumentCommitInput = z.infer<typeof DocumentCommitInput>;

export const DocTypeParam = z.object({ type: DealerDocType }).strict();
export type DocTypeParam = z.infer<typeof DocTypeParam>;

/**
 * The yard photograph — the hero of the dealership's public portfolio.
 *
 * It is not a KYC document, and it deliberately does not travel with them. The
 * three KYC documents are private, have no public delivery route and exist to
 * be checked once; this image is the first thing a buyer will ever see of the
 * dealership. Same presign → PUT → commit pipeline, different prefix,
 * different destiny.
 *
 * It lands on `dealer.coverMediaId` — the cover slot the profile already
 * carries — rather than on a column of its own, because that is exactly what
 * a cover image is.
 */
export const YARD_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const YARD_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export const YardPhotoPresignInput = z
  .object({
    fileName: z.string().trim().min(1).max(160),
    mimeType: z.enum(YARD_PHOTO_MIME_TYPES),
    bytes: z.number().int().min(1).max(YARD_PHOTO_MAX_BYTES),
    width: z.number().int().min(1).max(20000).optional(),
    height: z.number().int().min(1).max(20000).optional(),
  })
  .strict();
export type YardPhotoPresignInput = z.infer<typeof YardPhotoPresignInput>;

export const YardPhotoCommitInput = z.object({ mediaId: Uuid }).strict();
export type YardPhotoCommitInput = z.infer<typeof YardPhotoCommitInput>;

/**
 * `url` is a short-lived signed read rather than a delivery URL. The derivative
 * pipeline that content-addresses an image and gives it a permanent public URL
 * is **F034**; until it exists the only honest way to show the dealer what they
 * uploaded is to sign a read of the original object.
 */
export const YardPhotoDto = z.object({
  mediaId: Uuid.nullable(),
  status: MediaStatus.nullable(),
  fileName: z.string().nullable(),
  url: z.string().nullable(),
  uploadedAt: z.string().nullable(),
});
export type YardPhotoDto = z.infer<typeof YardPhotoDto>;

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
