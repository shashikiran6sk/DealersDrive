import type * as ContractsModule from '@dealers-drive/contracts';
import type * as EnvModule from '../../../../src/config/env.js';
import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { env } from '../../../../src/config/env.js';
import { createLegalPublication } from '../../../../src/modules/legal/legal-publication.js';
import { documentDigest } from '../../../../src/modules/legal/legal.evidence.js';

const fixture = vi.hoisted(() => {
  const policy = (id: 'terms' | 'privacy') => ({
    id,
    title: 'Test-only policy',
    route: `/${id}`,
    version: 'fixture-v1',
    reviewed: true,
    effectiveDate: '2026-01-01T00:00:00.000Z',
    sections: [
      { id: 'fixture', heading: 'Test fixture', paragraphs: ['Not a published legal document.'] },
    ],
  });
  return {
    docs: { terms: policy('terms'), privacy: policy('privacy') },
    approved: vi.fn(() => true),
  };
});
vi.mock('@dealers-drive/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof ContractsModule>();
  return {
    ...actual,
    LEGAL_DOCUMENTS: fixture.docs,
    ENQUIRY_NOTICE: 'Test-only notice',
    ENQUIRY_NOTICE_VERSION: 'fixture-v1',
    legalReleaseReady: fixture.approved,
    currentLegalDocument: (id: string) =>
      id === 'terms' || id === 'privacy' ? fixture.docs[id] : undefined,
  };
});
vi.mock('../../../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>();
  return { ...actual, env: { ...actual.env } };
});
const original = env.APP_ENV;
beforeEach(() => {
  env.APP_ENV = 'production';
  fixture.approved.mockReset().mockReturnValue(true);
});
afterEach(() => {
  env.APP_ENV = original;
});
interface Row {
  documentId: string;
  version: string;
  digest: string;
  publicationState: string;
  approvalReference: string | null;
  effectiveAt: Date | null;
}
function harness() {
  const row = (id: 'terms' | 'privacy' | 'enquiry'): Row => ({
    documentId: id,
    version: 'fixture-v1',
    digest: documentDigest(id),
    publicationState: 'PUBLISHED',
    approvalReference: 'test-approval',
    effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
  });
  const rows = { terms: row('terms'), privacy: row('privacy'), enquiry: row('enquiry') };
  const findUnique = vi.fn(
    async ({ where }: { where: { documentId_version: { documentId: string } } }) => {
      const id = where.documentId_version.documentId;
      return id === 'terms' || id === 'privacy' || id === 'enquiry' ? rows[id] : null;
    },
  );
  const prisma = { legalPolicyVersion: { findUnique } } as unknown as PrismaClient;
  return { rows, findUnique, service: createLegalPublication(prisma) };
}
it('requires registry release approval before querying publication metadata', async () => {
  fixture.approved.mockReturnValue(false);
  const h = harness();
  expect(await h.service.ready()).toBe(false);
  expect(h.findUnique).not.toHaveBeenCalled();
  expect(await h.service.current()).toEqual({
    state: 'UNAVAILABLE',
    collectionEnabled: false,
    documents: [],
    sharing: null,
  });
  env.APP_ENV = 'preview';
  expect((await h.service.current()).state).toBe('DRAFT');
});
it('serves exact approved fixtures only with matching immutable publication evidence', async () => {
  const h = harness();
  expect(await h.service.ready()).toBe(true);
  const current = await h.service.current();
  expect(current.state).toBe('PUBLISHED');
  expect(current.documents[0]?.digest).toBe(documentDigest('terms'));
  expect(current.documents[0]?.sections).toEqual(fixture.docs.terms.sections);
  expect(current.sharing?.digest).toBe(documentDigest('enquiry'));
});
it.each(['missing', 'draft', 'digest', 'approval', 'no-date', 'future', 'mismatch'])(
  'refuses invalid Terms/Privacy metadata: %s',
  async (bad) => {
    const h = harness();
    if (bad === 'missing') h.findUnique.mockResolvedValue(null);
    if (bad === 'draft') h.rows.terms.publicationState = 'DRAFT';
    if (bad === 'digest') h.rows.terms.digest = 'wrong';
    if (bad === 'approval') h.rows.terms.approvalReference = null;
    if (bad === 'no-date') h.rows.terms.effectiveAt = null;
    if (bad === 'future') h.rows.terms.effectiveAt = new Date('2999-01-01');
    if (bad === 'mismatch') h.rows.terms.effectiveAt = new Date('2026-01-02');
    expect(await h.service.ready()).toBe(false);
  },
);
it.each(['missing', 'draft', 'digest', 'approval', 'no-date', 'future'])(
  'requires independent sharing-notice publication evidence: %s',
  async (bad) => {
    const h = harness();
    if (bad === 'missing')
      h.findUnique.mockImplementation(async ({ where }) =>
        where.documentId_version.documentId === 'privacy'
          ? h.rows.privacy
          : where.documentId_version.documentId === 'terms'
            ? h.rows.terms
            : null,
      );
    if (bad === 'draft') h.rows.enquiry.publicationState = 'DRAFT';
    if (bad === 'digest') h.rows.enquiry.digest = 'wrong';
    if (bad === 'approval') h.rows.enquiry.approvalReference = null;
    if (bad === 'no-date') h.rows.enquiry.effectiveAt = null;
    if (bad === 'future') h.rows.enquiry.effectiveAt = new Date('2999-01-01');
    expect(await h.service.ready()).toBe(false);
  },
);
