import { z } from 'zod';

import { DealerDocType, type DocStatus } from './enums.js';

/**
 * The two evidence categories a dealership submits for review, plus the legacy
 * slot that applications started before the categories existed may still hold.
 *
 * A category is a slot: a dealership holds at most one document in each, of
 * whichever listed type it chose. The types are selectable evidence, not a
 * statement that each is legally equivalent or sufficient for every dealer — the
 * reviewer still judges the document actually supplied, and dealer verification
 * (`dealer-verification.ts`) records the regulatory and GST outcome separately.
 */
export const DealerDocCategory = z.enum(['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY', 'SUPPORTING']);
export type DealerDocCategory = z.infer<typeof DealerDocCategory>;

export const SelectableDocCategory = z.enum(['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY']);
export type SelectableDocCategory = z.infer<typeof SelectableDocCategory>;

export const DOC_CATEGORY_LABELS: Record<DealerDocCategory, string> = {
  PERSONAL_IDENTITY: 'Personal Identity Proof',
  BUSINESS_IDENTITY: 'Business Identity Proof',
  SUPPORTING: 'Supporting document',
};

/**
 * The single source of truth for which type belongs to which category, in the
 * order a picker offers them. `PAN_CARD` is the stored identifier for "PAN Card"
 * — rows, private object keys and audit history already use it, so it is not
 * renamed. `ADDRESS_PROOF` survives only as the legacy supporting slot and is
 * never offered for a new upload.
 */
export const DOC_CATEGORY_TYPES: Record<DealerDocCategory, readonly DealerDocType[]> = {
  PERSONAL_IDENTITY: ['AADHAAR', 'PAN_CARD', 'VOTER_ID', 'DRIVING_LICENCE', 'PASSPORT'],
  BUSINESS_IDENTITY: [
    'SHOP_ESTABLISHMENT',
    'GST_CERTIFICATE',
    'UDYAM',
    'TRADE_LICENSE',
    'BUSINESS_REGISTRATION',
    'PARTNERSHIP_REGISTRATION',
    'RTO_DEALER_AUTHORIZATION',
    'OTHER_BUSINESS_CERTIFICATE',
  ],
  SUPPORTING: ['ADDRESS_PROOF'],
};

export const SELECTABLE_DOC_CATEGORIES: readonly SelectableDocCategory[] =
  SelectableDocCategory.options;

export function documentCategoryOf(type: DealerDocType): DealerDocCategory {
  if (DOC_CATEGORY_TYPES.PERSONAL_IDENTITY.includes(type)) return 'PERSONAL_IDENTITY';
  if (DOC_CATEGORY_TYPES.BUSINESS_IDENTITY.includes(type)) return 'BUSINESS_IDENTITY';
  return 'SUPPORTING';
}

/** Hints shown beside a type in the picker. Aadhaar is voluntary and should be masked. */
export const DOC_TYPE_HINTS: Partial<Record<DealerDocType, string>> = {
  AADHAAR:
    'Voluntary. Upload a masked Aadhaar showing only the last four digits. Any other listed proof works instead.',
  OTHER_BUSINESS_CERTIFICATE: 'Describe the certificate and the authority that issued it.',
};

export const DOCUMENT_DESCRIPTION_MIN = 10;
export const DOCUMENT_DESCRIPTION_MAX = 200;

/**
 * The upload rules, in one place because both ends enforce them: the browser
 * checks them for the message, the presign signature bakes them in, and the
 * commit reads the stored bytes back and refuses a file whose content does not
 * match the type it was declared as.
 */
export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_EXTENSIONS: Record<DocumentMimeType, readonly string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
};

export function extensionMatches(fileName: string, mimeType: DocumentMimeType): boolean {
  const extension = fileName.toLowerCase().split('.').pop() ?? '';
  return fileName.includes('.') && DOCUMENT_EXTENSIONS[mimeType].includes(extension);
}

export const DocumentPresignInput = z
  .object({
    category: SelectableDocCategory,
    type: DealerDocType,
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .refine((name) => !/[\\/\u0000-\u001f]/.test(name), 'Use a plain file name.'),
    mimeType: z.enum(DOCUMENT_MIME_TYPES),
    bytes: z.number().int().min(1).max(DOCUMENT_MAX_BYTES, 'Keep the file under 5 MB.'),
    description: z
      .string()
      .trim()
      .min(DOCUMENT_DESCRIPTION_MIN)
      .max(DOCUMENT_DESCRIPTION_MAX)
      .optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (!DOC_CATEGORY_TYPES[input.category].includes(input.type)) {
      ctx.addIssue({
        code: 'custom',
        path: ['type'],
        message: 'Choose a document from this category.',
      });
    }
    if (input.type === 'OTHER_BUSINESS_CERTIFICATE' && !input.description) {
      ctx.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'Describe the certificate and who issued it.',
      });
    }
    if (input.type !== 'OTHER_BUSINESS_CERTIFICATE' && input.description !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'A description is only needed for another government certificate.',
      });
    }
    if (!extensionMatches(input.fileName, input.mimeType)) {
      ctx.addIssue({
        code: 'custom',
        path: ['fileName'],
        message: 'Upload a PDF, JPEG or PNG file.',
      });
    }
  });
export type DocumentPresignInput = z.infer<typeof DocumentPresignInput>;

export const DocCategoryParam = z.object({ category: SelectableDocCategory }).strict();
export type DocCategoryParam = z.infer<typeof DocCategoryParam>;

/**
 * What a document row needs to say for the requirement to be judged. Shared by
 * completeness (submitted is enough), approval and dealer verification
 * (verified is required), so the three can never disagree about what "the
 * documents" are.
 */
export interface DocumentFact {
  type: DealerDocType;
  status: DocStatus;
  fileName: string | null;
}

export type DocumentRequirementGap = SelectableDocCategory | 'GST_CERTIFICATE';

export const DOCUMENT_GAP_LABELS: Record<DocumentRequirementGap, string> = {
  PERSONAL_IDENTITY: 'Personal Identity Proof',
  BUSINESS_IDENTITY: 'Business Identity Proof',
  GST_CERTIFICATE: 'GST Registration Certificate (your GSTIN is on file)',
};

export function isSubmittedDocument(doc: DocumentFact): boolean {
  return (doc.status === 'UPLOADED' || doc.status === 'VERIFIED') && Boolean(doc.fileName);
}

export function isVerifiedDocument(doc: DocumentFact): boolean {
  return doc.status === 'VERIFIED' && Boolean(doc.fileName);
}

export interface DocumentRequirement<D extends DocumentFact> {
  satisfiedBy: D[] | null;
  gaps: DocumentRequirementGap[];
}

/**
 * One Personal Identity Proof and one Business Identity Proof. When a GSTIN is
 * on file the business proof is its GST Registration Certificate, which is the
 * document that relates to it (#298).
 *
 * An application started before the categories existed may instead hold the
 * legacy set — PAN card and address proof, plus the GST certificate with a
 * GSTIN — and is judged by it, so no in-flight application is stranded by the
 * change and no row has to be rewritten.
 */
export function documentRequirement<D extends DocumentFact>(
  documents: readonly D[],
  gstin: string | null | undefined,
  present: (doc: D) => boolean,
): DocumentRequirement<D> {
  const held = (category: DealerDocCategory) =>
    documents.find((doc) => documentCategoryOf(doc.type) === category && present(doc));
  const personal = held('PERSONAL_IDENTITY');
  const business = held('BUSINESS_IDENTITY');

  const gaps: DocumentRequirementGap[] = [];
  if (!personal) gaps.push('PERSONAL_IDENTITY');
  if (!business) gaps.push('BUSINESS_IDENTITY');
  else if (gstin && business.type !== 'GST_CERTIFICATE') gaps.push('GST_CERTIFICATE');
  if (personal && business && gaps.length === 0) return { satisfiedBy: [personal, business], gaps };

  const legacy = (type: DealerDocType) =>
    documents.find((doc) => doc.type === type && present(doc));
  const pan = legacy('PAN_CARD');
  const address = legacy('ADDRESS_PROOF');
  const gst = legacy('GST_CERTIFICATE');
  if (pan && address && (!gstin || gst)) {
    return { satisfiedBy: gstin && gst ? [gst, pan, address] : [pan, address], gaps: [] };
  }

  return { satisfiedBy: null, gaps };
}
