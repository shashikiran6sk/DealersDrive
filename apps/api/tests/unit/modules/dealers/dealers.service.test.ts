import type { PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DealerPrincipal } from '../../../../src/modules/auth/auth.facade.js';
import type { EnquiriesRepository } from '../../../../src/modules/enquiries/enquiries.facade.js';
import type {
  DealersRepository,
  DealerWithRelations,
} from '../../../../src/modules/dealers/dealers.repository.js';
import { createDealersService } from '../../../../src/modules/dealers/dealers.service.js';
import { DomainError, NotFoundError } from '../../../../src/platform/errors.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

/**
 * Unit tests for `src/modules/dealers/dealers.service.ts`.
 *
 * The parts worth isolating are the ones that are pure derivation over a lot of
 * inputs: the onboarding completeness stepper that gates `POST /v1/dealer/submit`,
 * the KYC document state labels, and the dashboard — whose `heightPct` is computed
 * here on purpose so the chart cannot disagree with the numbers printed beside it.
 * Reaching a particular week of view rollups through HTTP would mean seeding
 * time-dependent data; here it is three lines.
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
 * A KYC document row. `createdAt` is always present on a real row — the column is
 * NOT NULL — so every fixture carries one.
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
  documentById?: Record<string, unknown> | null;
  newEnquiryCount?: number;
  pendingListingCount?: number;
  deleteDocument?: boolean;
  head?: { bytes: number; contentType: string } | null;
  rollups?: { day: Date; _sum: { views: number | null } }[];
  previousViews?: number | null;
  counts?: number[];
  recent?: Record<string, unknown>[];
}

function setup(options: Options = {}) {
  const updates: { dealerId: string; data: Record<string, unknown> }[] = [];
  const upserts: { type: string; data: Record<string, unknown> }[] = [];
  const userUpdates: Record<string, unknown>[] = [];
  const outbox: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  const counts = [...(options.counts ?? [0, 0, 0, 0])];

  const row = options.dealer === null ? null : dealer(options.dealer ?? {});

  const repo = {
    findById: () => Promise.resolve(row),
    update: (dealerId: string, data: Record<string, unknown>) => {
      updates.push({ dealerId, data });
      return Promise.resolve(dealer({ ...(options.dealer ?? {}), ...data }));
    },
    documents: () => Promise.resolve(options.documents ?? []),
    documentById: () => Promise.resolve(options.documentById ?? null),
    upsertDocument: (_dealerId: string, type: string, data: Record<string, unknown>) => {
      upserts.push({ type, data });
      return Promise.resolve({});
    },
    deleteDocument: () => Promise.resolve(options.deleteDocument ?? true),
    newEnquiryCount: () => Promise.resolve(options.newEnquiryCount ?? 0),
    pendingListingCount: () => Promise.resolve(options.pendingListingCount ?? 0),
  } as unknown as DealersRepository;

  const tx = {
    user: {
      update: (args: Record<string, unknown>) => {
        userUpdates.push(args);
        return Promise.resolve({});
      },
    },
    outboxEvent: {
      create: (args: { data: Record<string, unknown> }) => {
        outbox.push(args.data);
        return Promise.resolve({});
      },
    },
  };

  const prisma = {
    $transaction: <T>(work: (handle: typeof tx) => Promise<T>) => work(tx),
    listingViewDaily: {
      groupBy: () => Promise.resolve(options.rollups ?? []),
      aggregate: () => Promise.resolve({ _sum: { views: options.previousViews ?? null } }),
    },
    enquiry: { count: () => Promise.resolve(counts.shift() ?? 0) },
    listing: { count: () => Promise.resolve(counts.shift() ?? 0) },
    creditTransaction: { count: () => Promise.resolve(counts.shift() ?? 0) },
  } as unknown as PrismaClient;

  const enquiries = {
    recentForDealer: () => Promise.resolve(options.recent ?? []),
  } as unknown as EnquiriesRepository;

  const storage = {
    presignPut: ({ key, contentType }: { key: string; contentType: string }) => ({
      uploadUrl: `https://storage.test/uploads?key=${key}`,
      method: 'PUT' as const,
      headers: { 'Content-Type': contentType },
      expiresInSeconds: 300,
    }),
    head: () => Promise.resolve(options.head ?? null),
    delete: (key: string) => {
      deletes.push(key);
      return Promise.resolve();
    },
  } as unknown as StoragePort;

  return {
    service: createDealersService({ prisma, repo, enquiries, storage }),
    updates,
    upserts,
    userUpdates,
    outbox,
    deletes,
  };
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

afterEach(() => {
  vi.useRealTimers();
});

describe('toProfile', () => {
  it('calls an ACTIVE dealership "Verified" rather than "Active"', async () => {
    const h = setup();

    // The dealer sees this word on their own profile; "Active" describes a row
    // state, "Verified" describes what a buyer is being told about them.
    expect((await h.service.profile('dealer-1')).statusLabel).toBe('Verified');
  });

  it('labels every other status from the shared table', async () => {
    const h = setup({ dealer: { status: 'SUSPENDED', statusReason: 'GST expired.' } });

    const profile = await h.service.profile('dealer-1');

    expect(profile.statusLabel).not.toBe('Verified');
    expect(profile.statusReason).toBe('GST expired.');
  });

  it('prefers the dealership contact number over the owner’s personal one', async () => {
    const h = setup({ dealer: { contactPhone: '9840099999' } });

    const profile = await h.service.profile('dealer-1');

    expect(profile.contact.phone).toBe('9840099999');
    expect(profile.contact.phoneDisplay).toBe('+91 98400 99999');
  });

  it('falls back to the owner’s number when the dealership has none', async () => {
    const h = setup({ dealer: { contactPhone: null } });

    expect((await h.service.profile('dealer-1')).contact.phone).toBe('9840012345');
  });

  it('reports an empty phone rather than null when neither exists', async () => {
    const h = setup({
      dealer: {
        contactPhone: null,
        members: [
          { userId: 'user-1', role: 'OWNER', user: { phone: null, emailVerifiedAt: null } },
        ],
      },
    });

    const profile = await h.service.profile('dealer-1');

    expect(profile.contact.phone).toBe('');
    expect(profile.contact.phoneDisplay).toBe('');
  });

  it('resolves the city name and state through the relation', async () => {
    const h = setup();

    expect((await h.service.profile('dealer-1')).address).toMatchObject({
      city: 'Vellore',
      state: 'Tamil Nadu',
      pincode: '632001',
    });
  });

  it('reports a null city for a dealership that has not set one', async () => {
    const h = setup({ dealer: { city: null, cityId: null } });

    const profile = await h.service.profile('dealer-1');

    expect(profile.address.city).toBeNull();
    expect(profile.address.state).toBeNull();
  });

  it('serialises dates as ISO strings, and a missing approval as null', async () => {
    const h = setup({ dealer: { approvedAt: null } });

    const profile = await h.service.profile('dealer-1');

    expect(profile.createdAt).toBe('2025-12-01T00:00:00.000Z');
    expect(profile.approvedAt).toBeNull();
  });

  it('404s a dealership that no longer exists', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.profile('dealer-1')).rejects.toThrow(NotFoundError);
  });
});

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

    expect(session.dealer.isVerified).toBe(false);
    expect(session.dealer.statusLabel).not.toBe('Verified');
  });

  it('falls back to the dealership phone when the acting member is not on the row', async () => {
    const h = setup({ dealer: { members: [] } });

    const session = await h.service.session(principal);

    expect(session.user.phone).toBe('9840012345');
    expect(session.user.fullName).toBeNull();
  });
});

describe('update', () => {
  it('writes only the fields that were sent', async () => {
    const h = setup();

    await h.service.update('dealer-1', { tagline: 'New tagline' });

    // C2 is partial precisely so a wizard `Back` never loses data; sending
    // `undefined` for everything else must not blank those columns.
    expect(h.updates[0]?.data).toEqual({ tagline: 'New tagline' });
  });

  /**
   * The service forwards the patch as given, so a `null` would reach the
   * column as a clear — but `UpdateDealerInput` marks `tagline` `.optional()`
   * without `.nullable()`, so a client has no way to send one. A dealer who
   * sets a tagline currently cannot remove it; the read schema
   * (`tagline: z.string().nullable()`) says the column allows it. Widening the
   * input contract is a product decision, so this test pins the behaviour that
   * *is* reachable: only the named field is written.
   */
  it('writes only the field named in the patch', async () => {
    const h = setup();

    await h.service.update('dealer-1', { tagline: 'Trusted since 1998' });

    expect(h.updates[0]?.data).toEqual({ tagline: 'Trusted since 1998' });
  });

  it('splits contact details between the user row and the dealership row', async () => {
    const h = setup();

    await h.service.update('dealer-1', {
      contact: { fullName: 'Ramesh K', email: 'new@example.com', landline: '0416 111 2222' },
    });

    expect(h.userUpdates[0]).toMatchObject({
      where: { id: 'user-1' },
      data: { fullName: 'Ramesh K', email: 'new@example.com' },
    });
    expect(h.updates[0]?.data).toMatchObject({
      contactEmail: 'new@example.com',
      landline: '0416 111 2222',
    });
  });

  it('never patches the phone number', async () => {
    const h = setup();

    await h.service.update('dealer-1', {
      contact: { fullName: 'Ramesh K' },
    });

    // The phone is the identity in this build; changing it would change who the
    // dealership is without going through verification.
    expect(JSON.stringify([h.updates, h.userUpdates])).not.toContain('phone');
  });

  it('touches no user row when the dealership has no owner', async () => {
    const h = setup({ dealer: { members: [] } });

    await h.service.update('dealer-1', { contact: { fullName: 'Nobody' } });

    expect(h.userUpdates).toEqual([]);
  });

  it('flattens the address into its columns', async () => {
    const h = setup();

    await h.service.update('dealer-1', {
      address: { line: '99 New Road', cityId: 'city-2', pincode: '632002' },
    });

    expect(h.updates[0]?.data).toEqual({
      addressLine: '99 New Road',
      cityId: 'city-2',
      pincode: '632002',
    });
  });

  it('writes nothing at all for an empty patch', async () => {
    const h = setup();

    await h.service.update('dealer-1', {});

    expect(h.updates[0]?.data).toEqual({});
  });

  it('404s a dealership that no longer exists', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.update('dealer-1', { tagline: 'x' })).rejects.toThrow(NotFoundError);
  });
});

describe('completeness', () => {
  const verified = [
    doc({ type: 'GST_CERTIFICATE', status: 'VERIFIED' }),
    doc({ type: 'PAN_CARD', status: 'VERIFIED' }),
    doc({ type: 'ADDRESS_PROOF', status: 'VERIFIED' }),
  ];

  it('reports every step complete for a finished profile', async () => {
    const h = setup({ documents: verified });

    const state = await h.service.completeness('dealer-1');

    expect(state.steps.map((step) => step.complete)).toEqual([true, true, true, true]);
    expect(state.percent).toBe(100);
    expect(state.isComplete).toBe(true);
  });

  it('names the missing account fields', async () => {
    const h = setup({
      documents: verified,
      dealer: {
        members: [
          { userId: 'user-1', role: 'OWNER', user: { fullName: null, email: null, phone: '9' } },
        ],
      },
    });

    const account = (await h.service.completeness('dealer-1')).steps[0];

    // The stepper renders these verbatim, so a vague "incomplete" would leave the
    // dealer clicking around looking for the field.
    expect(account?.missing).toEqual(['fullName', 'email']);
    expect(account?.complete).toBe(false);
  });

  it('names every missing business field', async () => {
    const h = setup({
      documents: verified,
      dealer: {
        brandName: '',
        legalName: null,
        addressLine: null,
        cityId: null,
        pincode: null,
        gstin: null,
        pan: null,
      },
    });

    expect((await h.service.completeness('dealer-1')).steps[1]?.missing).toEqual([
      'brandName',
      'legalName',
      'addressLine',
      'cityId',
      'pincode',
      'gstin',
      'pan',
    ]);
  });

  it('treats a missing, required or rejected document as outstanding', async () => {
    const h = setup({
      documents: [
        doc({ type: 'GST_CERTIFICATE', status: 'REQUIRED' }),
        doc({ type: 'PAN_CARD', status: 'REJECTED' }),
      ],
    });

    expect((await h.service.completeness('dealer-1')).steps[2]?.missing).toEqual([
      'GST_CERTIFICATE',
      'PAN_CARD',
      'ADDRESS_PROOF',
    ]);
  });

  it('accepts an uploaded document that has not been reviewed yet', async () => {
    const h = setup({
      documents: [
        doc({ type: 'GST_CERTIFICATE', status: 'UPLOADED' }),
        doc({ type: 'PAN_CARD', status: 'UPLOADED' }),
        doc({ type: 'ADDRESS_PROOF', status: 'VERIFIED' }),
      ],
    });

    // A dealer cannot wait for verification before submitting — that is what
    // submitting is for.
    expect((await h.service.completeness('dealer-1')).steps[2]?.complete).toBe(true);
  });

  it('marks the review step complete once the dealership has left DRAFT', async () => {
    const draft = setup({ documents: verified, dealer: { status: 'DRAFT' } });
    const submitted = setup({ documents: verified, dealer: { status: 'PENDING_APPROVAL' } });

    expect((await draft.service.completeness('dealer-1')).steps[3]?.complete).toBe(false);
    expect((await submitted.service.completeness('dealer-1')).steps[3]?.complete).toBe(true);
  });

  it('rounds the percentage over all four steps', async () => {
    const h = setup({ documents: [], dealer: { status: 'DRAFT' } });

    // Account and business complete, documents and review not: 2 of 4.
    expect((await h.service.completeness('dealer-1')).percent).toBe(50);
  });

  it('only allows a submit from DRAFT, and only when the first three steps are done', async () => {
    const ready = setup({ documents: verified, dealer: { status: 'DRAFT' } });
    const already = setup({ documents: verified, dealer: { status: 'PENDING_APPROVAL' } });
    const incomplete = setup({ documents: [], dealer: { status: 'DRAFT' } });

    expect((await ready.service.completeness('dealer-1')).canSubmit).toBe(true);
    expect((await already.service.completeness('dealer-1')).canSubmit).toBe(false);
    expect((await incomplete.service.completeness('dealer-1')).canSubmit).toBe(false);
  });

  it('does not count the review step towards isComplete', async () => {
    const h = setup({ documents: verified, dealer: { status: 'DRAFT' } });

    // Otherwise submitting would require having already submitted.
    const state = await h.service.completeness('dealer-1');
    expect(state.isComplete).toBe(true);
    expect(state.steps[3]?.complete).toBe(false);
  });
});

describe('submitForVerification', () => {
  const verified = [
    doc({ type: 'GST_CERTIFICATE', status: 'VERIFIED' }),
    doc({ type: 'PAN_CARD', status: 'VERIFIED' }),
    doc({ type: 'ADDRESS_PROOF', status: 'VERIFIED' }),
  ];

  it('moves a complete draft to PENDING_APPROVAL', async () => {
    const h = setup({ documents: verified, dealer: { status: 'DRAFT' } });

    const response = await h.service.submitForVerification('dealer-1');

    expect(h.updates[0]?.data).toEqual({ status: 'PENDING_APPROVAL' });
    expect(response.status).toBe('PENDING_APPROVAL');
    expect(response.statusLabel).toBe('Under review');
  });

  it('promises a decision within a working day', async () => {
    const h = setup({ documents: verified, dealer: { status: 'DRAFT' } });

    const response = await h.service.submitForVerification('dealer-1');

    const submitted = new Date(response.submittedAt).getTime();
    const expected = new Date(response.expectedDecisionBy).getTime();
    expect(expected - submitted).toBe(86_400_000);
    expect(response.message).toContain('one working day');
  });

  it('publishes DealerApplied in the same transaction as the status change', async () => {
    const h = setup({ documents: verified, dealer: { status: 'DRAFT' } });

    await h.service.submitForVerification('dealer-1');

    // One table: the notification is exactly as durable as the state change.
    expect(h.outbox).toHaveLength(1);
    expect(h.outbox[0]).toMatchObject({ eventType: 'DealerApplied', aggregateType: 'Dealer' });
  });

  it('refuses a second submission', async () => {
    const h = setup({ documents: verified, dealer: { status: 'PENDING_APPROVAL' } });

    await expect(h.service.submitForVerification('dealer-1')).rejects.toThrow(DomainError);
    await expect(h.service.submitForVerification('dealer-1')).rejects.toThrow(
      /already been submitted/,
    );
    expect(h.updates).toEqual([]);
  });

  it('refuses an incomplete profile and lists every missing field', async () => {
    const h = setup({
      documents: [],
      dealer: { status: 'DRAFT', gstin: null, pan: null },
    });

    try {
      await h.service.submitForVerification('dealer-1');
      expect.unreachable('an incomplete profile must not submit');
    } catch (error) {
      const domain = error as DomainError;
      expect(domain.code).toBe('PROFILE_INCOMPLETE');
      const fields = (domain.errors ?? []).map((entry) => entry.field);
      expect(fields).toContain('gstin');
      expect(fields).toContain('GST_CERTIFICATE');
      for (const entry of domain.errors ?? []) expect(entry.code).toBe('REQUIRED');
    }
  });

  it('does not write anything when the profile is incomplete', async () => {
    const h = setup({ documents: [], dealer: { status: 'DRAFT' } });

    await expect(h.service.submitForVerification('dealer-1')).rejects.toThrow(DomainError);
    expect([h.updates, h.outbox]).toEqual([[], []]);
  });
});

describe('documents', () => {
  it('returns all three document types even when none has been uploaded', async () => {
    const h = setup({ documents: [] });

    const response = await h.service.documents('dealer-1');

    // The screen is a checklist; a missing row would read as "not required".
    expect(response.data.map((doc) => doc.type)).toEqual([
      'GST_CERTIFICATE',
      'PAN_CARD',
      'ADDRESS_PROOF',
    ]);
    expect(response.data.every((doc) => doc.status === 'REQUIRED')).toBe(true);
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
});

describe('presignDocument', () => {
  it('keys a KYC document under a private prefix', async () => {
    const h = setup();

    const presigned = await h.service.presignDocument('dealer-1', {
      type: 'GST_CERTIFICATE',
      fileName: 'gst.pdf',
      mimeType: 'application/pdf',
      bytes: 2048,
    });

    // §26.6: the promise that buyers never see these is enforced by there being
    // no route that could serve them — and by the key living outside `vehicles/`.
    expect(presigned.uploadUrl).toContain(`kyc/dealer-1/GST_CERTIFICATE/${presigned.documentId}`);
    expect(presigned.uploadUrl).not.toContain('vehicles/');
  });

  it('records the document as UPLOADING before handing back the URL', async () => {
    const h = setup();

    const presigned = await h.service.presignDocument('dealer-1', {
      type: 'PAN_CARD',
      fileName: 'pan.pdf',
      mimeType: 'application/pdf',
      bytes: 1024,
    });

    expect(h.upserts[0]).toMatchObject({
      type: 'PAN_CARD',
      data: { id: presigned.documentId, status: 'UPLOADING', fileName: 'pan.pdf' },
    });
  });

  it('clears any previous rejection reason on a re-upload', async () => {
    const h = setup();

    await h.service.presignDocument('dealer-1', {
      type: 'ADDRESS_PROOF',
      fileName: 'eb-bill.pdf',
      mimeType: 'application/pdf',
      bytes: 1024,
    });

    // Otherwise the dealer uploads a clearer copy and still reads "Too blurry".
    expect(h.upserts[0]?.data).toMatchObject({ rejectionReason: null });
  });

  it('mints a fresh document id per presign', async () => {
    const h = setup();
    const input = {
      type: 'GST_CERTIFICATE' as const,
      fileName: 'gst.pdf',
      mimeType: 'application/pdf' as const,
      bytes: 1024,
    };

    const first = await h.service.presignDocument('dealer-1', input);
    const second = await h.service.presignDocument('dealer-1', input);

    expect(first.documentId).not.toBe(second.documentId);
  });
});

describe('commitDocument', () => {
  const stored = { id: 'doc-1', dealerId: 'dealer-1', type: 'GST_CERTIFICATE' };

  it('marks the document uploaded once the object is there', async () => {
    const h = setup({
      documentById: stored,
      head: { bytes: 2048, contentType: 'application/pdf' },
      documents: [doc({ type: 'GST_CERTIFICATE', status: 'UPLOADED', fileName: 'gst.pdf' })],
    });

    const result = await h.service.commitDocument('dealer-1', 'GST_CERTIFICATE', {
      documentId: 'doc-1',
    });

    expect(h.upserts[0]).toMatchObject({ data: { status: 'UPLOADED' } });
    expect(result?.type).toBe('GST_CERTIFICATE');
  });

  it('404s a document belonging to another dealership', async () => {
    const h = setup({ documentById: { ...stored, dealerId: 'dealer-2' } });

    // Cross-tenant reads answer 404, never 403 (§7).
    await expect(
      h.service.commitDocument('dealer-1', 'GST_CERTIFICATE', { documentId: 'doc-1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('404s when the document id names a different type', async () => {
    const h = setup({ documentById: { ...stored, type: 'PAN_CARD' } });

    await expect(
      h.service.commitDocument('dealer-1', 'GST_CERTIFICATE', { documentId: 'doc-1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('404s a document that does not exist', async () => {
    const h = setup({ documentById: null });

    await expect(
      h.service.commitDocument('dealer-1', 'GST_CERTIFICATE', { documentId: 'doc-1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('reports UPLOAD_MISSING when nothing landed', async () => {
    const h = setup({ documentById: stored, head: null });

    await expect(
      h.service.commitDocument('dealer-1', 'GST_CERTIFICATE', { documentId: 'doc-1' }),
    ).rejects.toThrow(/did not complete/);
    expect(h.upserts).toEqual([]);
  });
});

describe('deleteDocument', () => {
  it('removes the row and the stored object', async () => {
    const h = setup({ deleteDocument: true });

    await h.service.deleteDocument('dealer-1', 'GST_CERTIFICATE');

    expect(h.deletes).toEqual(['kyc/dealer-1/GST_CERTIFICATE']);
  });

  it('404s when there was nothing to delete, and touches storage anyway not at all', async () => {
    const h = setup({ deleteDocument: false });

    await expect(h.service.deleteDocument('dealer-1', 'GST_CERTIFICATE')).rejects.toThrow(
      NotFoundError,
    );
    expect(h.deletes).toEqual([]);
  });
});

describe('dashboard', () => {
  it('greets the owner by first name', async () => {
    const h = setup();

    const dashboard = await h.service.dashboard('dealer-1');

    expect(dashboard.greeting).toMatch(/^Good (morning|afternoon|evening), Kumar$/);
  });

  it('falls back to the brand name when no owner name is on file', async () => {
    const h = setup({
      dealer: {
        members: [{ userId: 'user-1', role: 'OWNER', user: { fullName: null, phone: '9' } }],
      },
    });

    expect((await h.service.dashboard('dealer-1')).greeting).toMatch(/Motors$/);
  });

  it('greets by the hour in IST', async () => {
    vi.useFakeTimers();
    // 03:30 UTC is 09:00 IST — morning here, still the previous evening in UTC-8.
    vi.setSystemTime(new Date('2026-08-17T03:30:00.000Z'));
    const h = setup();

    expect((await h.service.dashboard('dealer-1')).greeting).toContain('Good morning');

    vi.setSystemTime(new Date('2026-08-17T09:30:00.000Z'));
    expect((await setup().service.dashboard('dealer-1')).greeting).toContain('Good afternoon');

    vi.setSystemTime(new Date('2026-08-17T14:30:00.000Z'));
    expect((await setup().service.dashboard('dealer-1')).greeting).toContain('Good evening');
  });

  it('builds a seven-day series even with no views at all', async () => {
    const h = setup({ rollups: [] });

    const chart = (await h.service.dashboard('dealer-1')).viewsChart;

    // A chart with three bars because three days had traffic is a chart that
    // lies about the week.
    expect(chart.series).toHaveLength(7);
    expect(chart.series.every((point) => point.views === 0)).toBe(true);
  });

  it('scales bar heights against the week’s maximum', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00.000Z'));
    const today = new Date(Date.UTC(2026, 7, 17));
    const yesterday = new Date(Date.UTC(2026, 7, 16));
    const h = setup({
      rollups: [
        { day: today, _sum: { views: 40 } },
        { day: yesterday, _sum: { views: 10 } },
      ],
    });

    const chart = (await h.service.dashboard('dealer-1')).viewsChart;
    const byDate = new Map(chart.series.map((point) => [point.date, point]));

    expect(chart.max).toBe(40);
    expect(byDate.get('2026-08-17')?.heightPct).toBe(100);
    expect(byDate.get('2026-08-16')?.heightPct).toBe(25);
  });

  it('never divides by zero on a quiet week', async () => {
    const h = setup({ rollups: [] });

    const chart = (await h.service.dashboard('dealer-1')).viewsChart;

    expect(chart.max).toBe(1);
    expect(chart.series.every((point) => point.heightPct === 0)).toBe(true);
  });

  it('totals the week and labels it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00.000Z'));
    const h = setup({
      rollups: [
        { day: new Date(Date.UTC(2026, 7, 17)), _sum: { views: 1200 } },
        { day: new Date(Date.UTC(2026, 7, 16)), _sum: { views: 300 } },
      ],
    });

    const dashboard = await h.service.dashboard('dealer-1');

    expect(dashboard.viewsChart.totalLabel).toBe('1,500 total');
    expect(dashboard.stats.find((stat) => stat.key === 'views')?.value).toBe(1500);
  });

  it('treats a rollup row with a null sum as zero', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00.000Z'));
    const h = setup({
      rollups: [{ day: new Date(Date.UTC(2026, 7, 17)), _sum: { views: null } }],
    });

    expect((await h.service.dashboard('dealer-1')).viewsChart.series.at(-1)?.views).toBe(0);
  });

  it('reports no comparison when there is no previous week', async () => {
    const h = setup({ previousViews: null });

    const views = (await h.service.dashboard('dealer-1')).stats.find(
      (stat) => stat.key === 'views',
    );

    // A "−100%" against a week with no data would be a fabricated trend.
    expect(views?.delta).toBe('No data for last week');
    expect(views?.deltaTone).toBe('ok');
  });

  it('reports the view trend against the previous week', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00.000Z'));
    const up = setup({
      rollups: [{ day: new Date(Date.UTC(2026, 7, 17)), _sum: { views: 150 } }],
      previousViews: 100,
    });
    const down = setup({
      rollups: [{ day: new Date(Date.UTC(2026, 7, 17)), _sum: { views: 50 } }],
      previousViews: 100,
    });

    const upStat = (await up.service.dashboard('dealer-1')).stats.find((s) => s.key === 'views');
    const downStat = (await down.service.dashboard('dealer-1')).stats.find(
      (s) => s.key === 'views',
    );

    expect(upStat?.delta).toBe('+50% vs last week');
    expect(upStat?.deltaTone).toBe('ok');
    expect(downStat?.delta).toBe('−50% vs last week');
    expect(downStat?.deltaTone).toBe('warn');
  });

  it('reports the four stats the console renders', async () => {
    const h = setup();

    const dashboard = await h.service.dashboard('dealer-1');

    expect(dashboard.stats.map((stat) => stat.key)).toEqual([
      'activeListings',
      'credits',
      'newEnquiries',
      'views',
    ]);
  });

  it('says "No change this week" rather than "+0"', async () => {
    const h = setup({ counts: [0, 0, 0, 0] });

    const listings = (await h.service.dashboard('dealer-1')).stats.find(
      (stat) => stat.key === 'activeListings',
    );

    expect(listings?.delta).toBe('No change this week');
    expect(listings?.deltaTone).toBe('neutral');
  });

  it('formats the credit balance in the Indian grouping', async () => {
    const h = setup({ dealer: { creditBalance: 12_500 } });

    expect(
      (await h.service.dashboard('dealer-1')).stats.find((stat) => stat.key === 'credits')
        ?.valueLabel,
    ).toBe('12,500');
  });

  it('calls out the first week of enquiries instead of comparing to zero', async () => {
    const h = setup({ counts: [3, 0, 0, 0, 0] });

    const enquiryStat = (await h.service.dashboard('dealer-1')).stats.find(
      (stat) => stat.key === 'newEnquiries',
    );

    expect(enquiryStat?.delta).toBe('First week of enquiries');
  });

  it('renders recent enquiries with initials, a tel: link and a relative time', async () => {
    const h = setup({
      recent: [
        {
          id: 'enquiry-1',
          name: 'Anitha R',
          phone: '9876543210',
          createdAt: new Date(Date.now() - 3_600_000),
          vehicle: {
            year: 2021,
            make: { name: 'Maruti Suzuki' },
            model: { name: 'Alto 800' },
            variant: { name: 'VXI' },
          },
        },
      ],
    });

    const recent = (await h.service.dashboard('dealer-1')).recentEnquiries[0];

    expect(recent).toMatchObject({
      initials: 'AR',
      vehicleTitle: '2021 Maruti Suzuki Alto 800 VXI',
      phoneDisplay: '+91 98765 43210',
      callHref: 'tel:9876543210',
    });
    expect(recent?.timeAgoLabel.length).toBeGreaterThan(0);
  });

  it('reports a null vehicle title for a general enquiry', async () => {
    const h = setup({
      recent: [{ id: 'e', name: 'A B', phone: '9876543210', createdAt: new Date(), vehicle: null }],
    });

    expect((await h.service.dashboard('dealer-1')).recentEnquiries[0]?.vehicleTitle).toBeNull();
  });

  it('warns about listings expiring in the next week, pluralised', async () => {
    const many = setup({ counts: [0, 0, 3, 0, 0] });
    const one = setup({ counts: [0, 0, 1, 0, 0] });

    const manyAlert = (await many.service.dashboard('dealer-1')).alerts[0];
    const oneAlert = (await one.service.dashboard('dealer-1')).alerts[0];

    expect(manyAlert?.message).toBe('3 listings expire in the next 7 days.');
    expect(oneAlert?.message).toBe('1 listing expires in the next 7 days.');
    expect(manyAlert?.href).toBe('/dealer/inventory?status=ACTIVE');
  });

  it('raises no alert when nothing is expiring', async () => {
    const h = setup({ counts: [0, 0, 0, 0, 0] });

    expect((await h.service.dashboard('dealer-1')).alerts).toEqual([]);
  });

  it('reports the credit balance and held count alongside the stats', async () => {
    const h = setup();

    const dashboard = await h.service.dashboard('dealer-1');

    expect(dashboard.creditBalance).toBe(39);
    expect(dashboard.creditsHeld).toBe(2);
  });
});
