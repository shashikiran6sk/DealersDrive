import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { DealerPrincipal } from '../../../../src/modules/auth/auth.facade.js';
import type {
  DealersRepository,
  DealerWithRelations,
} from '../../../../src/modules/dealers/dealers.repository.js';
import { createDealersService } from '../../../../src/modules/dealers/dealers.service.js';
import { NotFoundError } from '../../../../src/platform/errors.js';

/**
 * Unit tests for `src/modules/dealers/dealers.service.ts`.
 *
 * The parts worth isolating are the ones that are pure derivation over a lot of
 * inputs — and the KYC checklist is the first of them to land. Reaching a
 * particular combination of document states through HTTP would mean seeding
 * rows; here it is three lines.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file has seven `describe` blocks. Two are here: `documents`,
 * which **F040** brings, and `session`, which landed with F018 and until now
 * had no unit test of its own — the integration suite covers it end to end
 * through `GET /v1/auth/me`, but the derivations it does (the status label, the
 * phone fallback, where the role comes from) are exactly the kind this file is
 * for, and they are already reachable.
 *
 * The other five — `toProfile`, `update`, `completeness`,
 * `submitForVerification`, `presignDocument`/`commitDocument`/`deleteDocument`
 * and `dashboard` — arrive with F041, F042, F043 and F048, along with the
 * `storage`, `enquiries` and `prisma` fakes each needs.
 * ────────────────────────────────────────────────────────────────────────────
 */
function dealer(overrides: Record<string, unknown> = {}): DealerWithRelations {
  return {
    id: 'dealer-1',
    slug: 'sri-lakshmi-motors',
    status: 'ACTIVE',
    statusReason: null,
    brandName: 'Sri Lakshmi Motors',
    legalName: 'Sri Lakshmi Motors Pvt Ltd',
    tagline: 'Trusted since 2009',
    about: 'Family-run dealership in Vellore.',
    gstin: '33AABCS1429B1ZX',
    pan: 'AABCS1429B',
    contactPhone: '9840012345',
    contactEmail: 'contact@sri-lakshmi-motors.in',
    landline: '0416 222 3344',
    addressLine: '12 Katpadi Road',
    cityId: 'city-1',
    city: { name: 'Vellore', state: 'Tamil Nadu' },
    pincode: '632001',
    specialities: ['Hatchbacks'],
    workingHours: { mon: '9:30–19:00' },
    establishedYear: 2009,
    logoMediaId: null,
    coverMediaId: null,
    creditBalance: 39,
    creditsHeld: 2,
    activeListings: 7,
    approvedAt: new Date('2026-01-05T00:00:00.000Z'),
    createdAt: new Date('2025-12-01T00:00:00.000Z'),
    members: [
      {
        userId: 'user-1',
        role: 'OWNER',
        user: {
          fullName: 'Ramesh Kumar',
          roleTitle: 'Proprietor',
          phone: '9840012345',
          email: 'owner@sri-lakshmi-motors.in',
          emailVerifiedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      },
    ],
    ...overrides,
  } as unknown as DealerWithRelations;
}

/**
 * A KYC document row. `createdAt` is always present on a real row — the column
 * is NOT NULL — so every fixture carries one.
 */
function doc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'doc-1',
    type: 'GST_CERTIFICATE',
    status: 'REQUIRED',
    fileName: null,
    rejectionReason: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

interface Options {
  dealer?: Record<string, unknown> | null;
  documents?: Record<string, unknown>[];
  newEnquiryCount?: number;
  pendingListingCount?: number;
}

function setup(options: Options = {}) {
  const row = options.dealer === null ? null : dealer(options.dealer ?? {});

  const repo = {
    findById: () => Promise.resolve(row),
    documents: () => Promise.resolve(options.documents ?? []),
    newEnquiryCount: () => Promise.resolve(options.newEnquiryCount ?? 0),
    pendingListingCount: () => Promise.resolve(options.pendingListingCount ?? 0),
  } as unknown as DealersRepository;

  return { service: createDealersService({ prisma: {} as unknown as PrismaClient, repo }) };
}

const principal: DealerPrincipal = {
  kind: 'DEALER',
  userId: 'user-1',
  dealerId: 'dealer-1',
  dealerSlug: 'sri-lakshmi-motors',
  role: 'OWNER',
  dealerStatus: 'ACTIVE',
  permissions: ['vehicle:write'],
} as unknown as DealerPrincipal;

describe('session', () => {
  it('reports the acting user, their dealership and the counts the shell renders', async () => {
    const h = setup({ newEnquiryCount: 3, pendingListingCount: 2 });

    const session = await h.service.session(principal);

    expect(session.user).toMatchObject({
      id: 'user-1',
      fullName: 'Ramesh Kumar',
      phoneDisplay: '+91 98400 12345',
      emailVerified: true,
    });
    expect(session.dealer).toMatchObject({
      slug: 'sri-lakshmi-motors',
      isVerified: true,
      creditBalance: 39,
      creditsHeld: 2,
    });
    expect(session.counts).toEqual({ newEnquiries: 3, pendingListings: 2 });
  });

  it('carries the role and permissions from the principal, not from the row', async () => {
    const h = setup();

    const session = await h.service.session(principal);

    // The permission table is the session's business; a dealership row cannot
    // grant itself capabilities.
    expect(session.role).toBe('OWNER');
    expect(session.permissions).toEqual(['vehicle:write']);
  });

  it('reports an unverified email as such', async () => {
    const h = setup({
      dealer: {
        members: [
          {
            userId: 'user-1',
            role: 'OWNER',
            user: { fullName: 'R', phone: '9840012345', email: 'a@b.c', emailVerifiedAt: null },
          },
        ],
      },
    });

    expect((await h.service.session(principal)).user.emailVerified).toBe(false);
  });

  it('marks a non-ACTIVE dealership as unverified', async () => {
    const h = setup({ dealer: { status: 'PENDING_APPROVAL' } });

    const session = await h.service.session(principal);

    expect(session.dealer?.isVerified).toBe(false);
    expect(session.dealer?.statusLabel).not.toBe('Verified');
  });

  it('falls back to the dealership phone when the acting member is not on the row', async () => {
    const h = setup({ dealer: { members: [] } });

    const session = await h.service.session(principal);

    expect(session.user.phone).toBe('9840012345');
    expect(session.user.fullName).toBeNull();
  });

  it('404s a dealership that no longer exists', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.session(principal)).rejects.toThrow(NotFoundError);
  });
});

describe('documents', () => {
  it('returns all three document types even when none has been uploaded', async () => {
    const h = setup({ documents: [] });

    const response = await h.service.documents('dealer-1');

    // The screen is a checklist; a missing row would read as "not required".
    expect(response.data.map((row) => row.type)).toEqual([
      'GST_CERTIFICATE',
      'PAN_CARD',
      'ADDRESS_PROOF',
    ]);
    expect(response.data.every((row) => row.status === 'REQUIRED')).toBe(true);
    expect(response.allVerified).toBe(false);
  });

  it('reports allVerified only when every document is verified', async () => {
    const all = setup({
      documents: [
        doc({ type: 'GST_CERTIFICATE', status: 'VERIFIED' }),
        doc({ type: 'PAN_CARD', status: 'VERIFIED' }),
        doc({ type: 'ADDRESS_PROOF', status: 'VERIFIED' }),
      ],
    });
    const some = setup({
      documents: [
        doc({ type: 'GST_CERTIFICATE', status: 'VERIFIED' }),
        doc({ type: 'PAN_CARD', status: 'UPLOADED' }),
      ],
    });

    expect((await all.service.documents('dealer-1')).allVerified).toBe(true);
    expect((await some.service.documents('dealer-1')).allVerified).toBe(false);
  });

  it('offers the right action for each state', async () => {
    const h = setup({
      documents: [
        doc({ type: 'GST_CERTIFICATE', status: 'UPLOADING' }),
        doc({ type: 'PAN_CARD', status: 'VERIFIED' }),
        doc({ type: 'ADDRESS_PROOF', status: 'REJECTED' }),
      ],
    });

    const byType = new Map((await h.service.documents('dealer-1')).data.map((d) => [d.type, d]));

    expect(byType.get('GST_CERTIFICATE')?.action).toBe('Cancel');
    expect(byType.get('PAN_CARD')?.action).toBe('Replace');
    expect(byType.get('ADDRESS_PROOF')?.action).toBe('Upload');
  });

  it('labels each state in words a dealer can act on', async () => {
    const h = setup({
      documents: [
        {
          type: 'GST_CERTIFICATE',
          status: 'UPLOADED',
          fileName: 'gst.pdf',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        },
        doc({ type: 'PAN_CARD', status: 'VERIFIED', fileName: 'pan.pdf' }),
        doc({ type: 'ADDRESS_PROOF', status: 'REJECTED', rejectionReason: 'Too blurry to read.' }),
      ],
    });

    const byType = new Map((await h.service.documents('dealer-1')).data.map((d) => [d.type, d]));

    expect(byType.get('GST_CERTIFICATE')?.statusLabel).toBe('gst.pdf · uploaded');
    expect(byType.get('PAN_CARD')?.statusLabel).toBe('pan.pdf · verified');
    expect(byType.get('ADDRESS_PROOF')?.statusLabel).toBe('Too blurry to read.');
  });

  it('states the upload rules for a document not yet provided', async () => {
    const h = setup({ documents: [] });

    expect((await h.service.documents('dealer-1')).data[0]?.statusLabel).toBe(
      'Required — PDF or JPG, max 5 MB',
    );
  });

  it('says "Uploading…" while a presign is outstanding', async () => {
    const h = setup({ documents: [doc({ type: 'GST_CERTIFICATE', status: 'UPLOADING' })] });

    expect((await h.service.documents('dealer-1')).data[0]?.statusLabel).toBe('Uploading…');
  });

  it('falls back to a generic reason for a rejection with no note', async () => {
    const h = setup({ documents: [doc({ type: 'GST_CERTIFICATE', status: 'REJECTED' })] });

    expect((await h.service.documents('dealer-1')).data[0]?.statusLabel).toMatch(/clearer copy/);
  });

  it('names the file as "File" when the row has no name', async () => {
    const h = setup({
      documents: [doc({ type: 'GST_CERTIFICATE', status: 'UPLOADED', fileName: null })],
    });

    expect((await h.service.documents('dealer-1')).data[0]?.statusLabel).toBe('File · uploaded');
  });

  /** The row id is what the admin verification endpoints address (F044). */
  it('carries the row id when there is one, and null when there is not', async () => {
    const h = setup({ documents: [doc({ type: 'GST_CERTIFICATE', id: 'doc-42' })] });

    const byType = new Map((await h.service.documents('dealer-1')).data.map((d) => [d.type, d]));

    expect(byType.get('GST_CERTIFICATE')?.id).toBe('doc-42');
    expect(byType.get('PAN_CARD')?.id).toBeNull();
  });

  it('serialises the upload time as an ISO string', async () => {
    const h = setup({ documents: [doc({ status: 'UPLOADED' })] });

    expect((await h.service.documents('dealer-1')).data[0]?.uploadedAt).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });
});
