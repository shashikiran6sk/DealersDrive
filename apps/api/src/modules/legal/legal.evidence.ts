import { createHash } from 'node:crypto';

import {
  ENQUIRY_NOTICE,
  ENQUIRY_NOTICE_VERSION,
  LEGAL_DOCUMENTS,
  LEGAL_VERSION,
  LISTING_CERTIFICATION,
  type AgreementAcceptance,
  type DealerAcceptanceInput,
  type LegalDocumentId,
} from '@dealers-drive/contracts';
import type { Listing, Vehicle, PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { Tx } from '../../platform/db/prisma.js';
import { DomainError, ForbiddenError } from '../../platform/errors.js';

export type LegalDb = PrismaClient | Tx;
export type EvidenceAction = 'ACCEPT' | 'ACKNOWLEDGE' | 'GRANT' | 'WITHDRAW' | 'CERTIFY';
export type EvidenceSubject = 'USER' | 'DEALER' | 'LISTING' | 'ENQUIRY';

export function legalEnabled(): boolean {
  return env.LEGAL_ENFORCEMENT_ENABLED === true;
}

export function documentDigest(documentId: LegalDocumentId | 'enquiry' | 'certification'): string {
  const snapshot =
    documentId === 'enquiry'
      ? { version: ENQUIRY_NOTICE_VERSION, text: ENQUIRY_NOTICE }
      : documentId === 'certification'
        ? { document: LEGAL_DOCUMENTS.listing, declaration: LISTING_CERTIFICATION }
        : LEGAL_DOCUMENTS[documentId];
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export function requireCurrentAcceptance(input: AgreementAcceptance | undefined): void {
  if (!legalEnabled()) {
    if (input)
      throw new DomainError(
        'LEGAL_NOT_ACTIVE',
        'Agreement collection is not active. Refresh before continuing.',
      );
    return;
  }
  if (!input?.accepted || !input.privacyAcknowledged) {
    throw new DomainError(
      'AGREEMENT_REQUIRED',
      'Read and accept the Terms and acknowledge the Privacy Policy to continue.',
    );
  }
  requireCurrentVersion(input.version);
}

export function requireCurrentVersion(version: string | undefined): void {
  if (!legalEnabled()) {
    if (version !== undefined)
      throw new DomainError(
        'LEGAL_NOT_ACTIVE',
        'Legal collection is not active. Refresh before continuing.',
      );
    return;
  }
  if (version !== LEGAL_VERSION) {
    throw new DomainError(
      'AGREEMENT_VERSION_CHANGED',
      'The document has changed. Open the current version and make your choice again.',
    );
  }
}

export async function accountIds(db: LegalDb, userId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE accounts AS (
      SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid
      UNION
      SELECT u."id" FROM "users" u JOIN accounts a ON u."mergedIntoId" = a."id"
    ) SELECT "id" FROM accounts`;
  return rows.map((row) => row.id);
}

export async function hasTerms(db: LegalDb, userId: string): Promise<boolean> {
  if (!legalEnabled()) return true;
  return (
    (await db.legalEvent.count({
      where: {
        subjectType: 'USER',
        subjectId: { in: await accountIds(db, userId) },
        documentId: 'terms',
        version: LEGAL_VERSION,
        digest: documentDigest('terms'),
        action: 'ACCEPT',
      },
    })) > 0
  );
}

export async function requireTerms(db: LegalDb, userId: string): Promise<void> {
  if (!(await hasTerms(db, userId))) {
    throw new DomainError(
      'AGREEMENT_REQUIRED',
      'Read and accept the current Terms before using this account feature. Login, support and privacy requests remain available.',
    );
  }
}

export async function hasDealerAgreement(db: LegalDb, dealerId: string): Promise<boolean> {
  if (!legalEnabled()) return true;
  return (
    (await db.legalEvent.count({
      where: {
        subjectType: 'DEALER',
        subjectId: dealerId,
        documentId: 'dealer',
        version: LEGAL_VERSION,
        digest: documentDigest('dealer'),
        action: 'ACCEPT',
      },
    })) > 0
  );
}

export async function requireDealerAgreement(db: LegalDb, dealerId: string): Promise<void> {
  if (!(await hasDealerAgreement(db, dealerId))) {
    throw new DomainError(
      'DEALER_AGREEMENT_REQUIRED',
      'An authorized owner must accept the current Dealer Agreement before this operation. Drafts, login and support remain available.',
    );
  }
}

export interface EvidenceInput {
  actorId: string;
  subjectType: EvidenceSubject;
  subjectId: string;
  documentId: LegalDocumentId | 'enquiry' | 'certification';
  action: EvidenceAction;
  context: string;
  occurrence?: string;
}

export async function recordEvidence(db: LegalDb, input: EvidenceInput): Promise<void> {
  if (!legalEnabled() && input.action !== 'WITHDRAW') return;
  const digest = documentDigest(input.documentId);
  const eventKey = createHash('sha256')
    .update(
      JSON.stringify([
        input.actorId,
        input.subjectType,
        input.subjectId,
        input.documentId,
        LEGAL_VERSION,
        digest,
        input.action,
        input.occurrence ?? '',
      ]),
    )
    .digest('hex');
  await db.legalEvent.createMany({
    data: {
      actorId: input.actorId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      documentId: input.documentId,
      version: LEGAL_VERSION,
      digest,
      action: input.action,
      context: input.context,
      eventKey,
    },
    skipDuplicates: true,
  });
}

export async function acceptTerms(
  db: LegalDb,
  userId: string,
  input: AgreementAcceptance | undefined,
  context: string,
): Promise<void> {
  requireCurrentAcceptance(input);
  await recordEvidence(db, {
    actorId: userId,
    subjectType: 'USER',
    subjectId: userId,
    documentId: 'terms',
    action: 'ACCEPT',
    context,
  });
  await recordEvidence(db, {
    actorId: userId,
    subjectType: 'USER',
    subjectId: userId,
    documentId: 'privacy',
    action: 'ACKNOWLEDGE',
    context: 'privacy-notice-acknowledgment',
  });
}

export async function acceptDealer(
  db: LegalDb,
  userId: string,
  dealerId: string,
  input: DealerAcceptanceInput | undefined,
): Promise<void> {
  if (!legalEnabled()) return;
  requireCurrentAcceptance(input);
  if (!input?.authorityConfirmed)
    throw new DomainError('AUTHORITY_REQUIRED', 'Confirm your authority to bind this dealership.');
  const membership = await db.dealerMember.findUnique({
    where: { dealerId_userId: { dealerId, userId } },
  });
  if (membership?.role !== 'OWNER' || membership.status !== 'ACTIVE') {
    throw new ForbiddenError(
      'Only an active owner authorized to bind this dealership may accept its agreement.',
      { code: 'DEALER_AUTHORITY_REQUIRED' },
    );
  }
  await acceptTerms(db, userId, input, 'dealer-agreement');
  await recordEvidence(db, {
    actorId: userId,
    subjectType: 'DEALER',
    subjectId: dealerId,
    documentId: 'dealer',
    action: 'ACCEPT',
    context: 'owner-authority-confirmed',
  });
}

export function certificationContext(
  vehicle: Vehicle,
  submission: number,
  assisted: boolean,
): string {
  const omitted = new Set(['createdAt', 'updatedAt', 'claimedAt', 'releasedAt']);
  const snapshot = Object.entries(vehicle)
    .filter(([key]) => !omitted.has(key) && key !== 'listing')
    .sort(([a], [b]) => a.localeCompare(b));
  const fingerprint = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return `${assisted ? 'assisted-owner' : 'submission'}:${submission}:${fingerprint}`;
}

export async function requireListingCertification(
  db: LegalDb,
  listing: Pick<Listing, 'id' | 'dealerId' | 'submissionCount'>,
  vehicle: Vehicle,
): Promise<void> {
  await requireDealerAgreement(db, listing.dealerId);
  if (!legalEnabled()) return;
  const count = await db.legalEvent.count({
    where: {
      subjectType: 'LISTING',
      subjectId: listing.id,
      documentId: 'certification',
      version: LEGAL_VERSION,
      digest: documentDigest('certification'),
      action: 'CERTIFY',
      context: {
        in: [
          certificationContext(vehicle, listing.submissionCount, false),
          certificationContext(vehicle, listing.submissionCount, true),
        ],
      },
    },
  });
  if (count === 0)
    throw new DomainError(
      'CERTIFICATION_REQUIRED',
      'A current declaration for this listing revision is required. Request changes so the dealer can review and submit it again.',
    );
}
