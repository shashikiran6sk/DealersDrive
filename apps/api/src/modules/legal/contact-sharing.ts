import { createHash, randomUUID } from 'node:crypto';

import {
  ENQUIRY_NOTICE,
  ENQUIRY_NOTICE_VERSION,
  type EnquirySharingPermission,
} from '@dealers-drive/contracts';
import type { ContactSharingEvent, Prisma } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';
import {
  ConflictError,
  DomainError,
  NotFoundError,
  UnauthorizedError,
} from '../../platform/errors.js';
import { accountIds, legalEnabled, type LegalDb } from './legal.evidence.js';

export const SHARING_PURPOSE = 'customer-initiated-dealership-enquiries';
export const SHARING_CATEGORIES = ['name', 'verified-mobile', 'submitted-enquiry-message'];
export const SHARING_NOTICE_DIGEST = createHash('sha256')
  .update(JSON.stringify({ version: ENQUIRY_NOTICE_VERSION, text: ENQUIRY_NOTICE }))
  .digest('hex');
export const SHARING_SCOPE_DIGEST = createHash('sha256')
  .update(
    JSON.stringify([
      SHARING_PURPOSE,
      SHARING_CATEGORIES,
      ENQUIRY_NOTICE_VERSION,
      SHARING_NOTICE_DIGEST,
    ]),
  )
  .digest('hex');

export function effectiveGrantWhere(now = new Date()): Prisma.ContactSharingEventWhereInput {
  return {
    action: 'GRANT',
    purpose: SHARING_PURPOSE,
    dataCategories: { equals: SHARING_CATEGORIES },
    scopeDigest: SHARING_SCOPE_DIGEST,
    noticeVersion: ENQUIRY_NOTICE_VERSION,
    noticeDigest: SHARING_NOTICE_DIGEST,
    withdrawal: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export function sharingDisclosureWhere(now = new Date()): Prisma.EnquiryWhereInput {
  return {
    sharingWithdrawnAt: null,
    OR: [
      ...(legalEnabled() ? [] : [{ sharingGrantId: null }]),
      { sharingGrant: { is: effectiveGrantWhere(now) } },
    ],
  };
}

export async function lockSharing(tx: Tx, customerId: string, dealerId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`contact-sharing:${customerId}:${dealerId}`}))`;
  const users = await tx.$queryRaw<
    { id: string }[]
  >`SELECT "id" FROM "users" WHERE "id" = ${customerId}::uuid AND "status" = 'ACTIVE' FOR SHARE`;
  if (users.length === 0) throw new UnauthorizedError();
}

export async function effectiveGrant(db: LegalDb, customerId: string, dealerId: string) {
  return db.contactSharingEvent.findFirst({
    where: { ...effectiveGrantWhere(), customerId, dealerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

export async function grantForEnquiry(
  tx: Tx,
  customerId: string,
  dealerId: string,
  recipientId: string | undefined,
  sharing: EnquirySharingPermission | undefined,
): Promise<ContactSharingEvent | null> {
  if (!legalEnabled()) {
    if (sharing || recipientId)
      throw new DomainError(
        'LEGAL_NOT_ACTIVE',
        'Sharing collection has changed. Refresh before continuing.',
      );
    await lockSharing(tx, customerId, dealerId);
    const current = await effectiveGrant(tx, customerId, dealerId);
    if (current) return current;
    const history = await tx.contactSharingEvent.count({
      where: { customerId: { in: await accountIds(tx, customerId) }, dealerId },
    });
    if (history > 0)
      throw new DomainError(
        'ENQUIRY_PERMISSION_REQUIRED',
        'A fresh sharing permission is required. Permission collection is unavailable for this deployment.',
      );
    return null;
  }
  if (recipientId !== dealerId)
    throw new ConflictError(
      'ENQUIRY_RECIPIENT_CHANGED',
      'The receiving dealership has changed. Review the enquiry and permission again.',
    );
  await lockSharing(tx, customerId, dealerId);
  if (sharing && sharing.version !== ENQUIRY_NOTICE_VERSION)
    throw new DomainError(
      'SHARING_NOTICE_CHANGED',
      'The sharing notice has changed. Review your permission again.',
    );
  const existing = await effectiveGrant(tx, customerId, dealerId);
  if (existing) return existing;
  if (!sharing?.granted)
    throw new DomainError(
      'ENQUIRY_PERMISSION_REQUIRED',
      'Choose whether to share your details with this dealership before sending.',
    );
  const id = randomUUID();
  return tx.contactSharingEvent.create({
    data: {
      id,
      customerId,
      dealerId,
      actorId: customerId,
      action: 'GRANT',
      purpose: SHARING_PURPOSE,
      dataCategories: SHARING_CATEGORIES,
      noticeVersion: ENQUIRY_NOTICE_VERSION,
      noticeDigest: SHARING_NOTICE_DIGEST,
      scopeDigest: SHARING_SCOPE_DIGEST,
      eventKey: `grant:${id}`,
    },
  });
}

export async function withdrawGrant(tx: Tx, customerId: string, grantId: string): Promise<void> {
  const grant = await tx.contactSharingEvent.findFirst({
    where: { id: grantId, action: 'GRANT', customerId: { in: await accountIds(tx, customerId) } },
  });
  if (!grant) throw new NotFoundError('That sharing permission is unavailable.');
  await lockSharing(tx, customerId, grant.dealerId);
  await tx.contactSharingEvent.createMany({
    data: {
      customerId: grant.customerId,
      dealerId: grant.dealerId,
      actorId: customerId,
      action: 'WITHDRAW',
      purpose: grant.purpose,
      dataCategories: grant.dataCategories,
      noticeVersion: grant.noticeVersion,
      noticeDigest: grant.noticeDigest,
      scopeDigest: grant.scopeDigest,
      withdrawnGrantId: grant.id,
      eventKey: `withdraw:${grant.id}`,
    },
    skipDuplicates: true,
  });
  await tx.enquiry.updateMany({
    where: { sharingGrantId: grant.id, sharingWithdrawnAt: null },
    data: { sharingWithdrawnAt: new Date() },
  });
}

export const SHARING_GRANT_SELECT = {
  id: true,
  action: true,
  customerId: true,
  dealerId: true,
  purpose: true,
  dataCategories: true,
  scopeDigest: true,
  noticeVersion: true,
  noticeDigest: true,
  expiresAt: true,
  withdrawal: { select: { id: true } },
} satisfies Prisma.ContactSharingEventSelect;

type Disclosure = {
  sharingWithdrawnAt: Date | null;
  customerId?: string;
  dealerId?: string;
  sharingGrant?: Prisma.ContactSharingEventGetPayload<{
    select: typeof SHARING_GRANT_SELECT;
  }> | null;
};

export function mayDiscloseEnquiry(row: Disclosure, now = new Date()): boolean {
  if (row.sharingWithdrawnAt) return false;
  const grant = row.sharingGrant;
  if (!grant) return !legalEnabled();
  return (
    grant.action === 'GRANT' &&
    grant.customerId === row.customerId &&
    grant.dealerId === row.dealerId &&
    grant.purpose === SHARING_PURPOSE &&
    grant.scopeDigest === SHARING_SCOPE_DIGEST &&
    grant.noticeVersion === ENQUIRY_NOTICE_VERSION &&
    grant.noticeDigest === SHARING_NOTICE_DIGEST &&
    JSON.stringify(grant.dataCategories) === JSON.stringify(SHARING_CATEGORIES) &&
    grant.withdrawal === null &&
    (grant.expiresAt === null || grant.expiresAt > now)
  );
}
