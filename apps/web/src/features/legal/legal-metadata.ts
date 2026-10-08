import 'server-only';
import {
  LEGAL_VERSION,
  legalDocumentSnapshot,
  legalReleaseReady,
  type LegalDocumentId,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { absoluteUrl, indexingEnabled } from '@/lib/seo';
export function legalMetadata(
  id: LegalDocumentId,
  archived = false,
  version: string = LEGAL_VERSION,
): Metadata {
  const document = legalDocumentSnapshot(id, version);
  if (!document) throw new Error('The requested document snapshot is unavailable.');
  return {
    title: document.title,
    description: `Dealers-Drive ${document.title}. Version ${document.version}.`,
    alternates: { canonical: absoluteUrl(document.route) },
    robots: {
      index: legalReleaseReady() && indexingEnabled() && !archived,
      follow: legalReleaseReady() && indexingEnabled(),
    },
  };
}
