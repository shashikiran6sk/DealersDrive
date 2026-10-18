import {
  LEGAL_DOCUMENTS,
  ENQUIRY_NOTICE,
  ENQUIRY_NOTICE_VERSION,
  legalReleaseReady,
  LegalPublication,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import { documentDigest, legalEnabled } from './legal.evidence.js';

export function createLegalPublication(prisma: PrismaClient) {
  async function ready(): Promise<boolean> {
    if (!legalReleaseReady()) return false;
    for (const document of Object.values(LEGAL_DOCUMENTS)) {
      const row = await prisma.legalPolicyVersion.findUnique({
        where: { documentId_version: { documentId: document.id, version: document.version } },
      });
      if (
        !row ||
        row.publicationState !== 'PUBLISHED' ||
        !row.approvalReference ||
        row.digest !== documentDigest(document.id) ||
        !row.effectiveAt ||
        row.effectiveAt > new Date() ||
        row.effectiveAt.getTime() !== Date.parse(document.effectiveDate ?? '')
      )
        return false;
    }
    const notice = await prisma.legalPolicyVersion.findUnique({
      where: { documentId_version: { documentId: 'enquiry', version: ENQUIRY_NOTICE_VERSION } },
    });
    return Boolean(
      notice &&
      notice.publicationState === 'PUBLISHED' &&
      notice.approvalReference &&
      notice.digest === documentDigest('enquiry') &&
      notice.effectiveAt &&
      notice.effectiveAt <= new Date(),
    );
  }
  return {
    ready,
    async current() {
      const published = await ready();
      if (env.APP_ENV === 'production' && !published)
        return LegalPublication.parse({
          state: 'UNAVAILABLE',
          collectionEnabled: false,
          documents: [],
          sharing: null,
        });
      return LegalPublication.parse({
        state: published ? 'PUBLISHED' : 'DRAFT',
        collectionEnabled: legalEnabled(),
        documents: Object.values(LEGAL_DOCUMENTS).map((document) => ({
          id: document.id,
          title: document.title,
          version: document.version,
          digest: documentDigest(document.id),
          reviewed: document.reviewed,
          effectiveDate: document.effectiveDate,
          sections: document.sections.map((section) => ({
            id: section.id,
            heading: section.heading,
            paragraphs: [...section.paragraphs],
          })),
        })),
        sharing: {
          version: ENQUIRY_NOTICE_VERSION,
          text: ENQUIRY_NOTICE,
          digest: documentDigest('enquiry'),
        },
      });
    },
  };
}
export type LegalPublicationService = ReturnType<typeof createLegalPublication>;
