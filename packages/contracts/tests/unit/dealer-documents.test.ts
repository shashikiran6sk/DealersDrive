import { describe, expect, it } from 'vitest';

import {
  DOC_CATEGORY_TYPES,
  DOCUMENT_MAX_BYTES,
  DocumentPresignInput,
  documentCategoryOf,
  documentRequirement,
  isSubmittedDocument,
  isVerifiedDocument,
  type DocumentFact,
} from '../../src/dealer-documents.js';
import { DOC_TYPE_LABELS, DealerDocType } from '../../src/enums.js';

const file = { fileName: 'proof.pdf', mimeType: 'application/pdf' as const, bytes: 2048 };

describe('the document categories', () => {
  it('places every type in exactly one category, with a label', () => {
    const all = Object.values(DOC_CATEGORY_TYPES).flat();
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...DealerDocType.options].sort());
    for (const type of DealerDocType.options) expect(DOC_TYPE_LABELS[type]).toBeTruthy();
  });

  it('offers the owner-approved options, Aadhaar marked voluntary', () => {
    expect(DOC_CATEGORY_TYPES.PERSONAL_IDENTITY).toEqual([
      'AADHAAR',
      'PAN_CARD',
      'VOTER_ID',
      'DRIVING_LICENCE',
      'PASSPORT',
    ]);
    expect(DOC_TYPE_LABELS.AADHAAR).toBe('Aadhaar Card (Voluntary)');
    expect(DOC_CATEGORY_TYPES.BUSINESS_IDENTITY).toHaveLength(8);
    expect(documentCategoryOf('ADDRESS_PROOF')).toBe('SUPPORTING');
  });
});

describe('DocumentPresignInput', () => {
  it.each(DOC_CATEGORY_TYPES.PERSONAL_IDENTITY)('accepts personal proof %s', (type) => {
    expect(
      DocumentPresignInput.safeParse({ ...file, category: 'PERSONAL_IDENTITY', type }).success,
    ).toBe(true);
  });

  it.each(
    DOC_CATEGORY_TYPES.BUSINESS_IDENTITY.filter((type) => type !== 'OTHER_BUSINESS_CERTIFICATE'),
  )('accepts business proof %s', (type) => {
    expect(
      DocumentPresignInput.safeParse({ ...file, category: 'BUSINESS_IDENTITY', type }).success,
    ).toBe(true);
  });

  it('requires a description for another government certificate, and only for it', () => {
    const other = { ...file, category: 'BUSINESS_IDENTITY', type: 'OTHER_BUSINESS_CERTIFICATE' };
    expect(DocumentPresignInput.safeParse(other).success).toBe(false);
    expect(
      DocumentPresignInput.safeParse({ ...other, description: 'Municipal dealer licence, Vellore' })
        .success,
    ).toBe(true);
    expect(
      DocumentPresignInput.safeParse({
        ...file,
        category: 'PERSONAL_IDENTITY',
        type: 'PASSPORT',
        description: 'Not needed here at all',
      }).success,
    ).toBe(false);
  });

  it('refuses a type from the other category, a legacy slot and an unknown type', () => {
    expect(
      DocumentPresignInput.safeParse({ ...file, category: 'PERSONAL_IDENTITY', type: 'UDYAM' })
        .success,
    ).toBe(false);
    expect(
      DocumentPresignInput.safeParse({ ...file, category: 'SUPPORTING', type: 'ADDRESS_PROOF' })
        .success,
    ).toBe(false);
    expect(
      DocumentPresignInput.safeParse({
        ...file,
        category: 'BUSINESS_IDENTITY',
        type: 'MY_OWN_CERTIFICATE',
      }).success,
    ).toBe(false);
  });

  it('refuses a missing selection', () => {
    expect(DocumentPresignInput.safeParse({ ...file, category: 'PERSONAL_IDENTITY' }).success).toBe(
      false,
    );
  });

  it.each([
    ['an invalid MIME type', { mimeType: 'image/gif', fileName: 'proof.gif' }],
    ['an extension that does not match', { fileName: 'proof.exe' }],
    ['a file with no extension', { fileName: 'proof' }],
    ['a PDF declared for a PNG name', { fileName: 'proof.png' }],
    ['a path in the name', { fileName: '../../etc/passwd.pdf' }],
    ['an oversized file', { bytes: DOCUMENT_MAX_BYTES + 1 }],
    ['an empty file', { bytes: 0 }],
  ])('refuses %s', (_label, change) => {
    expect(
      DocumentPresignInput.safeParse({
        ...file,
        ...change,
        category: 'PERSONAL_IDENTITY',
        type: 'PASSPORT',
      }).success,
    ).toBe(false);
  });

  it('accepts .jpg and .jpeg for JPEG, case-insensitively', () => {
    for (const fileName of ['scan.JPG', 'scan.jpeg']) {
      expect(
        DocumentPresignInput.safeParse({
          ...file,
          fileName,
          mimeType: 'image/jpeg',
          category: 'PERSONAL_IDENTITY',
          type: 'VOTER_ID',
        }).success,
      ).toBe(true);
    }
  });
});

describe('documentRequirement', () => {
  const doc = (
    type: DocumentFact['type'],
    status: DocumentFact['status'] = 'UPLOADED',
  ): DocumentFact => ({
    type,
    status,
    fileName: `${type}.pdf`,
  });

  it('is met by one proof from each category', () => {
    const result = documentRequirement([doc('VOTER_ID'), doc('UDYAM')], null, isSubmittedDocument);
    expect(result.gaps).toEqual([]);
    expect(result.satisfiedBy?.map((row) => row.type)).toEqual(['VOTER_ID', 'UDYAM']);
  });

  it('names each missing category', () => {
    expect(documentRequirement([], null, isSubmittedDocument).gaps).toEqual([
      'PERSONAL_IDENTITY',
      'BUSINESS_IDENTITY',
    ]);
    expect(documentRequirement([doc('PASSPORT')], null, isSubmittedDocument).gaps).toEqual([
      'BUSINESS_IDENTITY',
    ]);
  });

  it('does not count an interrupted upload, a rejection or a row without a file', () => {
    const rows = [doc('PASSPORT', 'UPLOADING'), doc('UDYAM', 'REJECTED')];
    expect(documentRequirement(rows, null, isSubmittedDocument).satisfiedBy).toBeNull();
    expect(
      documentRequirement(
        [{ type: 'PASSPORT', status: 'UPLOADED', fileName: null }, doc('UDYAM')],
        null,
        isSubmittedDocument,
      ).gaps,
    ).toEqual(['PERSONAL_IDENTITY']);
  });

  it('needs verification, not just submission, when asked for verified documents', () => {
    expect(
      documentRequirement([doc('PASSPORT'), doc('UDYAM')], null, isVerifiedDocument).satisfiedBy,
    ).toBeNull();
    expect(
      documentRequirement(
        [doc('PASSPORT', 'VERIFIED'), doc('UDYAM', 'VERIFIED')],
        null,
        isVerifiedDocument,
      ).gaps,
    ).toEqual([]);
  });

  it('accepts the legacy set an application started before the categories may hold', () => {
    const legacy = [doc('PAN_CARD', 'VERIFIED'), doc('ADDRESS_PROOF', 'VERIFIED')];
    expect(
      documentRequirement(legacy, null, isVerifiedDocument).satisfiedBy?.map((row) => row.type),
    ).toEqual(['PAN_CARD', 'ADDRESS_PROOF']);
    expect(
      documentRequirement(legacy, '33AABCS1429P1Z5', isVerifiedDocument).satisfiedBy,
    ).toBeNull();
    expect(
      documentRequirement(
        [...legacy, doc('GST_CERTIFICATE', 'VERIFIED')],
        '33AABCS1429P1Z5',
        isVerifiedDocument,
      ).satisfiedBy,
    ).not.toBeNull();
  });
});
