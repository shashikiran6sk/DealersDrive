import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LegalAcceptInput,
  DealerLegalSubmitInput,
  TERMS_V1,
  PRIVACY_V1,
  LEGAL_TERMS_VERSION,
  LEGAL_PRIVACY_VERSION,
  legalV1Enabled,
  legalV1Ready,
  LEGAL_V1_PUBLICATION,
} from '../../src/index.js';

describe('legal V1 inputs and publication', () => {
  it.each([undefined, false, 'true', 1, null])(
    'rejects non-affirmative acceptance %s',
    (accepted) => {
      expect(LegalAcceptInput.safeParse({ scope: 'CUSTOMER', accepted }).success).toBe(false);
    },
  );
  it.each(['userId', 'dealerId', 'termsVersion', 'privacyVersion', 'acceptedAt'])(
    'rejects client-controlled %s',
    (field) => {
      expect(
        LegalAcceptInput.safeParse({ scope: 'DEALER', accepted: true, [field]: 'forged' }).success,
      ).toBe(false);
    },
  );
  it('accepts exactly one affirmative checkbox for either scope', () => {
    for (const scope of ['CUSTOMER', 'DEALER'])
      expect(LegalAcceptInput.parse({ scope, accepted: true })).toEqual({ scope, accepted: true });
    expect(DealerLegalSubmitInput.parse({})).toEqual({});
    expect(DealerLegalSubmitInput.safeParse({ accepted: false }).success).toBe(false);
  });
  it('keeps the published reference versions aligned and has exactly two documents', () => {
    expect([TERMS_V1.route, PRIVACY_V1.route]).toEqual(['/terms', '/privacy']);
    const manifest = JSON.parse(
      readFileSync(new URL('../../../../docs/legal/v1-manifest.json', import.meta.url), 'utf8'),
    ) as { sourceSha256: string };
    const source = readFileSync(new URL('../../src/legal-documents/v1.ts', import.meta.url));
    expect(createHash('sha256').update(source).digest('hex')).toBe(manifest.sourceSha256);
    expect(TERMS_V1.version).toBe(LEGAL_TERMS_VERSION);
    expect(PRIVACY_V1.version).toBe(LEGAL_PRIVACY_VERSION);
    for (const doc of [TERMS_V1, PRIVACY_V1])
      expect(new Set(doc.sections.map((s) => s.id)).size).toBe(doc.sections.length);
  });
  it('cannot activate an incomplete legal release in production, even with preview enabled', () => {
    expect(legalV1Ready()).toBe(true);
    const incomplete = { ...LEGAL_V1_PUBLICATION, operatorName: null };
    expect(legalV1Ready(incomplete)).toBe(false);
    expect(legalV1Enabled(true, true, incomplete)).toBe(false);
    expect(legalV1Enabled(true, false)).toBe(true);
    expect(legalV1Enabled(false, true)).toBe(true);
    expect(legalV1Enabled(false, false)).toBe(false);
  });
});
