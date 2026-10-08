import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AgreementAcceptance,
  DealerAcceptanceInput,
  EnquirySharingPermission,
  LEGAL_DOCUMENTS,
  LEGAL_VERSION,
  LegalEvidenceQuery,
  SubmitVehicleInput,
  legalDocumentSnapshot,
  legalNoticeSnapshot,
  legalReleaseReady,
} from '../../src/legal.js';
const fingerprints = {
  terms: '15b73644d5de54fe97568de70e676570abf2baa55cb7c0f83313f853c98ec059',
  privacy: '9ef6be3661e5a3fa57151d125b4a7e74b7a9ca6f50df32434652f639df3165ba',
  dealer: 'b0d63029194bdfe2d7de6872502bf64c3ea1412a553da2619d4daf2453577fd2',
  listing: '0a36f39814b964b39635e86acafa4f1c4cd982c3d8e3ca5050842b0e7229364e',
  grievance: '8c7a47c071ac7cacf6514c4b1c8949674a57fe4572326dcb807ec2fbb0ad1566',
  rights: '069ed5bfe8a660110408fd8c2a02ac62e322bc2b20e8c8629362f0437f3ccf64',
};
describe('immutable legal snapshots', () => {
  it('preserves version fingerprints and keeps every current document retrievable by its version', () => {
    for (const document of Object.values(LEGAL_DOCUMENTS)) {
      expect(createHash('sha256').update(JSON.stringify(document)).digest('hex')).toBe(
        fingerprints[document.id],
      );
      expect(legalDocumentSnapshot(document.id, document.version)).toEqual(document);
      expect(document.reviewed).toBe(false);
      expect(document.effectiveDate).toBeNull();
    }
    expect(legalDocumentSnapshot('terms', 'unknown')).toBeUndefined();
    expect(legalNoticeSnapshot('enquiry', LEGAL_VERSION)?.text).toContain('unrelated marketing');
    expect(legalNoticeSnapshot('certification', LEGAL_VERSION)?.text).toContain('authorized');
    expect(legalNoticeSnapshot('enquiry', 'unknown')).toBeUndefined();
    expect(legalReleaseReady()).toBe(false);
  });
  it('requires explicit true choices and refuses client identities, marketing bundling and extra fields', () => {
    const account = { version: LEGAL_VERSION, accepted: true, privacyAcknowledged: true };
    expect(AgreementAcceptance.safeParse(account).success).toBe(true);
    expect(AgreementAcceptance.safeParse({ ...account, accepted: false }).success).toBe(false);
    expect(AgreementAcceptance.safeParse({ ...account, privacyAcknowledged: false }).success).toBe(
      false,
    );
    expect(AgreementAcceptance.safeParse({ ...account, actorId: 'forged' }).success).toBe(false);
    expect(AgreementAcceptance.safeParse({ ...account, marketingConsent: true }).success).toBe(
      false,
    );
    expect(DealerAcceptanceInput.safeParse(account).success).toBe(false);
    expect(DealerAcceptanceInput.safeParse({ ...account, authorityConfirmed: true }).success).toBe(
      true,
    );
    expect(
      DealerAcceptanceInput.safeParse({ ...account, authorityConfirmed: true, dealerId: 'forged' })
        .success,
    ).toBe(false);
    expect(
      EnquirySharingPermission.safeParse({ version: LEGAL_VERSION, granted: false }).success,
    ).toBe(false);
    expect(
      EnquirySharingPermission.safeParse({ version: LEGAL_VERSION, granted: true }).success,
    ).toBe(true);
    expect(
      SubmitVehicleInput.safeParse({ certification: { version: LEGAL_VERSION, certified: false } })
        .success,
    ).toBe(false);
    expect(
      SubmitVehicleInput.safeParse({ certification: { version: LEGAL_VERSION, certified: true } })
        .success,
    ).toBe(true);
    expect(LegalEvidenceQuery.safeParse({ subjectType: 'USER' }).success).toBe(false);
    expect(
      LegalEvidenceQuery.safeParse({ subjectType: 'USER', subjectId: 'invalid' }).success,
    ).toBe(false);
  });
});
