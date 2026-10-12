import { describe, expect, it } from 'vitest';

import { isPlainFileName } from '../../src/common.js';
import {
  ActivationOverrideInput,
  MANUAL_ACTIVATION_DISCLAIMER_VERSION,
  RevokeActivationOverrideInput,
} from '../../src/dealer-activation.js';
import {
  PORTFOLIO_PHOTO_MAX_BYTES,
  PortfolioModerationQuery,
  PortfolioPhotoCommitInput,
  PortfolioPhotoPresignInput,
} from '../../src/dealer-portfolio.js';
import { CreateYardVisitInput, YardVisitPhotoPresignInput } from '../../src/dealer-yard-visits.js';

const UUID = '7f3c9a21-4444-4000-8000-000000000009';
const JUSTIFICATION =
  'Field team confirmed the owner in person; policy exception OPS-2026-114 approved.';

describe('isPlainFileName', () => {
  it.each(['forecourt.jpg', 'GST certificate (2026).pdf', 'ಮಳಿಗೆ.png'])('accepts %s', (name) => {
    expect(isPlainFileName(name)).toBe(true);
  });

  it.each(['../etc/passwd', 'a\\b.jpg', 'line\nbreak.jpg', 'nul\u0000.jpg'])(
    'refuses %j',
    (name) => {
      expect(isPlainFileName(name)).toBe(false);
    },
  );
});

describe('the manual activation input', () => {
  const valid = {
    justification: JUSTIFICATION,
    acknowledgedDisclaimer: MANUAL_ACTIVATION_DISCLAIMER_VERSION,
  };

  it('accepts an acknowledged disclaimer and a full justification', () => {
    expect(ActivationOverrideInput.safeParse(valid).success).toBe(true);
  });

  it('refuses a stale disclaimer version, a short justification and a dealerId', () => {
    expect(
      ActivationOverrideInput.safeParse({
        ...valid,
        acknowledgedDisclaimer: 'manual-activation-v0',
      }).success,
    ).toBe(false);
    expect(
      ActivationOverrideInput.safeParse({ ...valid, justification: 'Looks fine to me.' }).success,
    ).toBe(false);
    expect(ActivationOverrideInput.safeParse({ ...valid, dealerId: UUID }).success).toBe(false);
  });

  it('cannot carry a document decision or a verification flag', () => {
    expect(ActivationOverrideInput.safeParse({ ...valid, verifyDocuments: true }).success).toBe(
      false,
    );
    expect(ActivationOverrideInput.safeParse({ ...valid, isVerified: true }).success).toBe(false);
  });

  it('asks for a reason when the activation is withdrawn', () => {
    expect(RevokeActivationOverrideInput.safeParse({ reason: 'No.' }).success).toBe(false);
    expect(
      RevokeActivationOverrideInput.safeParse({
        reason: 'Documents could not be produced on request.',
      }).success,
    ).toBe(true);
  });
});

describe('portfolio photographs', () => {
  const photo = { fileName: 'forecourt.jpg', mimeType: 'image/jpeg', bytes: 2048 };

  it('accepts JPEG, PNG and WebP up to the limit', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(PortfolioPhotoPresignInput.safeParse({ ...photo, mimeType }).success).toBe(true);
    }
    expect(
      PortfolioPhotoPresignInput.safeParse({ ...photo, bytes: PORTFOLIO_PHOTO_MAX_BYTES }).success,
    ).toBe(true);
  });

  it('refuses another type, an oversized file, a path and an unknown field', () => {
    expect(PortfolioPhotoPresignInput.safeParse({ ...photo, mimeType: 'image/gif' }).success).toBe(
      false,
    );
    expect(
      PortfolioPhotoPresignInput.safeParse({ ...photo, bytes: PORTFOLIO_PHOTO_MAX_BYTES + 1 })
        .success,
    ).toBe(false);
    expect(
      PortfolioPhotoPresignInput.safeParse({ ...photo, fileName: '../../x.jpg' }).success,
    ).toBe(false);
    expect(PortfolioPhotoPresignInput.safeParse({ ...photo, status: 'APPROVED' }).success).toBe(
      false,
    );
  });

  it('lets a dealer name what a photograph replaces, but never approve it', () => {
    expect(PortfolioPhotoCommitInput.safeParse({ mediaId: UUID, replacesId: UUID }).success).toBe(
      true,
    );
    expect(PortfolioPhotoCommitInput.safeParse({ mediaId: UUID, status: 'APPROVED' }).success).toBe(
      false,
    );
  });

  it('queues pending or rejected photographs only', () => {
    expect(PortfolioModerationQuery.parse({})).toEqual({ status: 'PENDING' });
    expect(PortfolioModerationQuery.safeParse({ status: 'APPROVED' }).success).toBe(false);
  });
});

describe('yard visits', () => {
  it('records a visit on or before today, with a known outcome', () => {
    expect(
      CreateYardVisitInput.safeParse({ visitedOn: '2026-10-01', outcome: 'NO_PHYSICAL_YARD' })
        .success,
    ).toBe(true);
    expect(
      CreateYardVisitInput.safeParse({ visitedOn: '2999-01-01', outcome: 'YARD_CONFIRMED' })
        .success,
    ).toBe(false);
    expect(
      CreateYardVisitInput.safeParse({ visitedOn: '01/10/2026', outcome: 'YARD_CONFIRMED' })
        .success,
    ).toBe(false);
    expect(
      CreateYardVisitInput.safeParse({ visitedOn: '2026-10-01', outcome: 'PASSED' }).success,
    ).toBe(false);
  });

  it('takes photographs only, and never a public flag', () => {
    const upload = { fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: 2048 };
    expect(YardVisitPhotoPresignInput.safeParse(upload).success).toBe(true);
    expect(
      YardVisitPhotoPresignInput.safeParse({ ...upload, mimeType: 'application/pdf' }).success,
    ).toBe(false);
    expect(YardVisitPhotoPresignInput.safeParse({ ...upload, public: true }).success).toBe(false);
  });
});
