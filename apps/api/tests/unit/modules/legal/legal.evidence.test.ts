import type { PrismaClient } from '@prisma/client';
import { LEGAL_VERSION, LEGAL_DOCUMENTS } from '@dealers-drive/contracts';
import { describe, expect, it, vi } from 'vitest';
import type * as envModule from '../../../../src/config/env.js';
import {
  acceptDealer,
  acceptTerms,
  documentDigest,
  hasDealerAgreement,
  hasTerms,
  recordEvidence,
  requireCurrentAcceptance,
  requireCurrentVersion,
  requireDealerAgreement,
  requireTerms,
} from '../../../../src/modules/legal/legal.evidence.js';

const setting = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../../../src/config/env.js', async (original) => {
  const actual = await original<typeof envModule>();
  return {
    ...actual,
    env: {
      ...actual.env,
      get LEGAL_ENFORCEMENT_ENABLED() {
        return setting.enabled;
      },
    },
  };
});
const input = { version: LEGAL_VERSION, accepted: true, privacyAcknowledged: true } as const;
function database(role = 'OWNER', status = 'ACTIVE', count = 0) {
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  const counts = vi.fn().mockResolvedValue(count);
  const ids = vi.fn().mockResolvedValue([{ id: 'canonical' }, { id: 'absorbed' }]);
  return {
    db: {
      legalEvent: { createMany, count: counts },
      dealerMember: { findUnique: vi.fn().mockResolvedValue({ role, status }) },
      $queryRaw: ids,
    } as unknown as PrismaClient,
    createMany,
    counts,
    ids,
  };
}
describe('legal evidence', () => {
  it('requires the current explicit agreement, not implied or stale choices', () => {
    setting.enabled = true;
    expect(() => requireCurrentAcceptance(undefined)).toThrow(/Read and accept/);
    expect(() => requireCurrentAcceptance({ ...input, version: 'old' })).toThrow(/changed/);
    expect(() => requireCurrentVersion(undefined)).toThrow(/changed/);
    expect(() => requireCurrentAcceptance(input)).not.toThrow();
  });
  it('does not fabricate acceptance while disabled and refuses contradictory rollout payloads', async () => {
    setting.enabled = false;
    const { db, createMany, counts } = database();
    expect(() => requireCurrentAcceptance(undefined)).not.toThrow();
    expect(() => requireCurrentAcceptance(input)).toThrow(/not active/);
    expect(() => requireCurrentVersion(LEGAL_VERSION)).toThrow(/not active/);
    await acceptTerms(db, 'user', undefined, 'disabled');
    await acceptDealer(db, 'user', 'dealer', undefined);
    expect(await hasTerms(db, 'user')).toBe(true);
    expect(await hasDealerAgreement(db, 'dealer')).toBe(true);
    expect(createMany).not.toHaveBeenCalled();
    expect(counts).not.toHaveBeenCalled();
    setting.enabled = true;
  });
  it('records separate contract and notice choices with only minimal evidence', async () => {
    const { db, createMany } = database();
    await acceptTerms(db, 'user', input, 'registration');
    expect(createMany).toHaveBeenCalledTimes(2);
    expect(createMany.mock.calls.map((call) => call[0].data.action)).toEqual([
      'ACCEPT',
      'ACKNOWLEDGE',
    ]);
    expect(createMany.mock.calls[0]?.[0]).toMatchObject({
      skipDuplicates: true,
      data: {
        actorId: 'user',
        subjectType: 'USER',
        subjectId: 'user',
        documentId: 'terms',
        version: LEGAL_VERSION,
        digest: documentDigest('terms'),
      },
    });
    expect(createMany.mock.calls[0]?.[0].data).not.toHaveProperty('createdAt');
    expect(createMany.mock.calls[0]?.[0].data).not.toHaveProperty('ip');
  });
  it.each([
    ['MANAGER', 'ACTIVE'],
    ['STAFF', 'ACTIVE'],
    ['OWNER', 'DISABLED'],
  ])('refuses binding by %s / %s', async (role, status) => {
    const { db, createMany } = database(role, status);
    await expect(
      acceptDealer(db, 'user', 'dealer', { ...input, authorityConfirmed: true }),
    ).rejects.toThrow(/active owner/);
    expect(createMany).not.toHaveBeenCalled();
  });
  it('records only the owner’s actual authority declaration', async () => {
    const { db, createMany } = database();
    await expect(acceptDealer(db, 'user', 'dealer', undefined)).rejects.toThrow();
    await acceptDealer(db, 'user', 'dealer', { ...input, authorityConfirmed: true });
    expect(createMany.mock.calls[2]?.[0].data).toMatchObject({
      documentId: 'dealer',
      action: 'ACCEPT',
      subjectId: 'dealer',
      context: 'owner-authority-confirmed',
    });
  });
  it('scopes requirements to exact text and account/dealership; refusing does not create evidence', async () => {
    const { db, counts, createMany } = database();
    await expect(requireTerms(db, 'canonical')).rejects.toThrow(/Login, support/);
    await expect(requireDealerAgreement(db, 'dealer')).rejects.toThrow(/authorized owner/);
    expect(counts.mock.calls[0]?.[0].where).toMatchObject({
      subjectId: { in: ['canonical', 'absorbed'] },
      version: LEGAL_VERSION,
      digest: documentDigest('terms'),
    });
    expect(counts.mock.calls[1]?.[0].where).toMatchObject({
      subjectId: 'dealer',
      digest: documentDigest('dealer'),
    });
    expect(createMany).not.toHaveBeenCalled();
    counts.mockResolvedValue(1);
    await expect(requireTerms(db, 'canonical')).resolves.toBeUndefined();
    await expect(requireDealerAgreement(db, 'dealer')).resolves.toBeUndefined();
  });
  it('deduplicates retries while retaining separate submission occurrences', async () => {
    const { db, createMany } = database();
    const event = {
      actorId: 'user',
      subjectType: 'LISTING',
      subjectId: 'listing',
      documentId: 'certification',
      action: 'CERTIFY',
      context: 'submit',
    } as const;
    await recordEvidence(db, { ...event, occurrence: '1' });
    await recordEvidence(db, { ...event, occurrence: '1' });
    await recordEvidence(db, { ...event, occurrence: '2' });
    expect(createMany.mock.calls[0]?.[0].data.eventKey).toBe(
      createMany.mock.calls[1]?.[0].data.eventKey,
    );
    expect(createMany.mock.calls[2]?.[0].data.eventKey).not.toBe(
      createMany.mock.calls[0]?.[0].data.eventKey,
    );
    expect(documentDigest('enquiry')).toMatch(/^[0-9a-f]{64}$/);
    expect(documentDigest('certification')).toMatch(/^[0-9a-f]{64}$/);
    for (const document of Object.values(LEGAL_DOCUMENTS))
      expect(documentDigest(document.id)).toMatch(/^[0-9a-f]{64}$/);
  });
});
