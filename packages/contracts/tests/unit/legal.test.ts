import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LegalAcceptInput,
  DealerLegalSubmitInput,
  TERMS_V1,
  TERMS_V1_1,
  PRIVACY_V1,
  LEGAL_ACCEPTED_TERMS_VERSIONS,
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
    expect(TERMS_V1.version).toBe('terms-v1.0');
    expect(TERMS_V1_1.version).toBe(LEGAL_TERMS_VERSION);
    expect(PRIVACY_V1.version).toBe(LEGAL_PRIVACY_VERSION);
    for (const doc of [TERMS_V1, TERMS_V1_1, PRIVACY_V1])
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

describe('Terms version 1.1', () => {
  const v11 = JSON.parse(
    readFileSync(new URL('../../../../docs/legal/v1-1-manifest.json', import.meta.url), 'utf8'),
  ) as { termsVersion: string; effectiveDate: string; renderedSha256: string };

  it('is locked by its own manifest, on the text a reader sees', () => {
    expect(v11.termsVersion).toBe(TERMS_V1_1.version);
    expect(v11.effectiveDate).toBe(TERMS_V1_1.effectiveDate);
    expect(createHash('sha256').update(JSON.stringify(TERMS_V1_1)).digest('hex')).toBe(
      v11.renderedSha256,
    );
  });

  it('changes only the photography paragraphs and adds a version note', () => {
    const changed = TERMS_V1_1.sections
      .filter(
        (section, index) => JSON.stringify(section) !== JSON.stringify(TERMS_V1.sections[index]),
      )
      .map((section) => section.id);
    expect(changed).toEqual(['platform', 'photography', 'changes']);
    expect(TERMS_V1_1.sections.map((section) => section.heading)).toEqual(
      TERMS_V1.sections.map((section) => section.heading),
    );
    const [about] = TERMS_V1_1.sections[0]!.paragraphs;
    expect(about).toBe(TERMS_V1.sections[0]!.paragraphs[0]);
  });

  it('no longer says Dealers-Drive photographs every vehicle, and says who else may', () => {
    const text = JSON.stringify(TERMS_V1_1);
    expect(text).not.toContain('We currently photograph vehicles');
    expect(text).toContain('taken either by us or by the dealership');
    expect(text).toContain('that check does not verify the vehicle’s condition');
    expect(JSON.stringify(TERMS_V1)).toContain('We currently photograph vehicles');
  });

  it('keeps an acceptance of 1.0 valid alongside 1.1', () => {
    expect(LEGAL_ACCEPTED_TERMS_VERSIONS).toEqual(['terms-v1.0', 'terms-v1.1']);
  });
});
