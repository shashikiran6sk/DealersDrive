import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { DealerPrincipal } from '../../../../src/modules/auth/auth.facade.js';
import type {
  DealersRepository,
  DealerWithRelations,
} from '../../../../src/modules/dealers/dealers.repository.js';
import { createDealersService } from '../../../../src/modules/dealers/dealers.service.js';
import type { AuditService } from '../../../../src/platform/audit/audit.service.js';
import { DomainError, NotFoundError } from '../../../../src/platform/errors.js';
import type { MapsPort } from '../../../../src/platform/maps/maps-link.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

/**
 * Unit tests for `src/modules/dealers/dealers.service.ts`.
 *
 * The parts worth isolating are the ones that are pure derivation over a lot of
 * inputs — and the KYC checklist is the first of them to land. Reaching a
 * particular combination of document states through HTTP would mean seeding
 * rows; here it is three lines.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file has seven `describe` blocks. F040 brought `documents` and
 * `session`; **F041 brings `toProfile`, `update`, `presignDocument`,
 * `commitDocument` and `deleteDocument`**, along with the `storage` fake and
 * the transaction stub they need.
 *
 * F043 brought `completeness` and **F042 `submitForVerification`**, which is
 * six of the seven. `dashboard` arrives with F048 — the last of which needs the
 * `enquiries` fake and a much larger `prisma` one.
 * ────────────────────────────────────────────────────────────────────────────
 */
/**
 * The fixture dealership's folder. Every object it owns hangs off this one
 * prefix — the KYC scans under `documents/`, the yard photograph under `yard/`
 * — so a test that asserts a key asserts the layout as well as the file name.
 */
const DEALER_ROOT = 'dealers/sri-lakshmi-motors-pvt-ltd-vellore-tamil-nadu';

function dealer(overrides: Record<string, unknown> = {}): DealerWithRelations {
  return {
    id: 'dealer-1',
    // The slug carries the address now — it is the portfolio's URL *and* the
    // name of this dealership's folder in the bucket, and every key asserted
    // below is derived from it.
    slug: 'sri-lakshmi-motors-pvt-ltd-vellore-tamil-nadu',
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
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632001',
    mapsUrl: 'https://maps.app.goo.gl/sri-lakshmi-motors',
    specialities: ['Hatchbacks'],
    workingHours: { mon: '9:30–19:00' },
    establishedYear: 2009,
    logoMediaId: null,
    // The yard photograph. Present by default, because the completeness
    // fixtures below describe a *finished* profile and a finished profile has
    // one — a dealership cannot be submitted for verification without it.
    coverMediaId: 'media-1',
    creditBalance: 39,
    creditsHeld: 2,
    activeListings: 7,
    approvedAt: new Date('2026-01-05T00:00:00.000Z'),
    createdAt: new Date('2025-12-01T00:00:00.000Z'),
    /**
     * R34. Empty by default: an ordinary dealership has nothing waiting on a
     * moderator, and `profileChange` on the response is `null`. The tests that
     * care put a row here.
     */
    profileEdits: [],
    members: [
      {
        userId: 'user-1',
        role: 'OWNER',
        user: {
          fullName: 'Ramesh Kumar',
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

/** A `Media` row, as the yard-photo paths read one back. */
function media(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'media-1',
    dealerId: 'dealer-1',
    ownerType: 'DEALER_COVER',
    storageKey: `${DEALER_ROOT}/yard/media-1`,
    mimeType: 'image/jpeg',
    bytes: 184_210,
    fileName: 'yard.jpg',
    status: 'PENDING',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  };
}

interface Options {
  dealer?: Record<string, unknown> | null;
  documents?: Record<string, unknown>[];
  documentById?: Record<string, unknown> | null;
  documentByType?: Record<string, unknown> | null;
  deleteDocument?: boolean;
  head?: { bytes: number; contentType: string } | null;
  newEnquiryCount?: number;
  pendingListingCount?: number;
  /** What `findConflicting` reports — a name, GSTIN or PAN already taken. */
  conflicting?: { legalName: boolean; gstin: boolean; pan: boolean };
  /** Who already holds the number a phone patch asks for, if anybody. */
  phoneHolder?: { id: string } | null;
  /** One row, or several to be looked up by id — a replacement needs two. */
  media?: Record<string, unknown> | Record<string, unknown>[] | null;
  /** What the dealer's Maps link resolves to. Omitted means "it did not". */
  geo?: { lat: number; lng: number } | null;
  placeId?: string | null;
}

function setup(options: Options = {}) {
  const updates: { dealerId: string; data: Record<string, unknown> }[] = [];
  const upserts: { type: string; data: Record<string, unknown> }[] = [];
  const userUpdates: Record<string, unknown>[] = [];
  const phoneLookups: string[] = [];
  const outbox: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  const mediaCreated: Record<string, unknown>[] = [];
  const orphaned: string[] = [];
  const readied: string[] = [];
  const conflictQueries: { dealerId: string; fields: Record<string, unknown> }[] = [];

  const row = options.dealer === null ? null : dealer(options.dealer ?? {});

  const repo = {
    findById: () => Promise.resolve(row),
    slugById: () => Promise.resolve(row?.slug ?? null),
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
    documentByType: () =>
      Promise.resolve(
        options.documentByType === undefined
          ? (options.deleteDocument ?? true)
            ? doc()
            : null
          : options.documentByType,
      ),
    findConflicting: (dealerId: string, fields: Record<string, unknown>) => {
      conflictQueries.push({ dealerId, fields });
      return Promise.resolve(options.conflicting ?? { legalName: false, gstin: false, pan: false });
    },
    mediaById: (mediaId: string) => {
      if (!options.media) return Promise.resolve(null);
      const rows = Array.isArray(options.media) ? options.media : [options.media];
      return Promise.resolve(rows.find((row) => row.id === mediaId) ?? null);
    },
    createMedia: (data: Record<string, unknown>) => {
      mediaCreated.push(data);
      return Promise.resolve(data);
    },
    orphanMedia: (mediaId: string) => {
      orphaned.push(mediaId);
      return Promise.resolve({});
    },
    markMediaReady: (mediaId: string) => {
      readied.push(mediaId);
      return Promise.resolve({});
    },
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
    // The uniqueness read in front of a phone change. `phoneHolder` is who
    // already has the number: undefined for nobody, a row for somebody.
    user: {
      findUnique: (args: { where: { phone: string } }) => {
        phoneLookups.push(args.where.phone);
        return Promise.resolve(options.phoneHolder ?? null);
      },
    },
    $transaction: <T>(work: (handle: typeof tx) => Promise<T>) => work(tx),
  } as unknown as PrismaClient;

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
    signedReadUrl: (key: string, ttl: number) =>
      Promise.resolve(`https://storage.test/signed/${key}?ttl=${ttl}`),
  } as unknown as StoragePort;

  /*
   * The yard's pin, faked.
   *
   * A port rather than a bare call precisely so this stays local: without it
   * every save below would issue a real request to Google while the suite runs
   * — slow, flaky, and dependent on the network of whoever is running it.
   */
  const mapsLookups: string[] = [];
  const maps: MapsPort = {
    placeFor: (mapsUrl: string) => {
      mapsLookups.push(mapsUrl);
      return Promise.resolve({
        coordinates: options.geo ?? null,
        placeId: options.placeId ?? null,
      });
    },
  };

  /**
   * R34's audit port. Recording is asserted where it matters — the integration
   * suite, against a real table — so the double here only has to exist: this
   * file's subject is the service's own logic, and an audit row is a side
   * effect of it rather than a part of it.
   */
  const audited: { action: string; entityId: string }[] = [];
  const audit = {
    record: (_tx: unknown, entry: { action: string; entityId: string }) => {
      audited.push({ action: entry.action, entityId: entry.entityId });
      return Promise.resolve();
    },
    recordDetached: (entry: { action: string; entityId: string }) => {
      audited.push({ action: entry.action, entityId: entry.entityId });
      return Promise.resolve();
    },
  } as unknown as AuditService;

  return {
    service: createDealersService({ prisma, repo, storage, maps, audit }),
    audited,
    updates,
    upserts,
    userUpdates,
    phoneLookups,
    outbox,
    deletes,
    mediaCreated,
    orphaned,
    readied,
    conflictQueries,
    mapsLookups,
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
      slug: 'sri-lakshmi-motors-pvt-ltd-vellore-tamil-nadu',
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

  it('reads the city, district and state off the dealership itself', async () => {
    const h = setup();

    expect((await h.service.profile('dealer-1')).address).toMatchObject({
      city: 'Vellore',
      district: 'Vellore',
      state: 'Tamil Nadu',
      pincode: '632001',
    });
  });

  it('reports a null locality for a dealership that has not set one', async () => {
    const h = setup({ dealer: { city: null, district: null, state: null } });

    const profile = await h.service.profile('dealer-1');

    expect(profile.address.city).toBeNull();
    expect(profile.address.district).toBeNull();
    expect(profile.address.state).toBeNull();
  });

  /**
   * R20 — the dealer's own screen has to say what their link is worth, because
   * the map it produces is on a page they are not looking at. The three
   * answers, from the same function the portfolio's embed URL comes from.
   */
  describe('the kind of map the stored link draws', () => {
    it('is PLACE when the row names a place', async () => {
      const h = setup({ dealer: { mapsPlaceId: '0xaaa:0xbbb', lat: 12.9165, lng: 79.1325 } });

      expect((await h.service.profile('dealer-1')).address.mapKind).toBe('PLACE');
    });

    it('is POINT when the row has a pin and names nothing', async () => {
      const h = setup({ dealer: { mapsPlaceId: null, lat: 12.9165, lng: 79.1325 } });

      expect((await h.service.profile('dealer-1')).address.mapKind).toBe('POINT');
    });

    /** Half a coordinate is not a place: it would centre a map in the sea. */
    it('is NONE when the link resolved to neither', async () => {
      const h = setup({ dealer: { mapsPlaceId: null, lat: 12.9165, lng: null } });

      expect((await h.service.profile('dealer-1')).address.mapKind).toBe('NONE');
    });

    it('is NONE for a dealership that has not answered yet', async () => {
      const h = setup({ dealer: { mapsUrl: null, mapsPlaceId: null, lat: null, lng: null } });

      const profile = await h.service.profile('dealer-1');

      // Both halves, because the form tells the two apart with `mapsUrl`.
      expect(profile.address.mapsUrl).toBeNull();
      expect(profile.address.mapKind).toBe('NONE');
    });
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

describe('update', () => {
  it('writes only the field named in the patch', async () => {
    const h = setup();

    await h.service.update('dealer-1', { tagline: 'Trusted since 1998' });

    // C2 is partial precisely so a wizard `Back` never loses data; sending
    // `undefined` for everything else must not blank those columns.
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

  it('leaves the phone alone when the patch does not mention it', async () => {
    const h = setup();

    await h.service.update('dealer-1', { contact: { fullName: 'Ramesh K' } });

    // Partial means partial: a patch about a name must not touch the number,
    // and must not spend a uniqueness read asking about it either.
    expect(JSON.stringify([h.updates, h.userUpdates])).not.toContain('phone');
    expect(h.phoneLookups).toEqual([]);
  });

  /**
   * The number is patchable now — it stopped being a credential when dealers
   * moved to Google sign-in, and the step that asks for it is reached again by
   * pressing Back.
   *
   * Two columns, one answer: `users.phone` is who the dealer is to us,
   * `dealers.contactPhone` is what a buyer is shown. Onboarding writes both, so
   * an edit has to as well — a stale mirror publishes the old number.
   */
  it('writes a new phone number to both the user row and the dealership row', async () => {
    const h = setup();

    await h.service.update('dealer-1', { contact: { phone: '98765 43210' } });

    expect(h.userUpdates[0]).toMatchObject({
      where: { id: 'user-1' },
      data: { phone: '+919876543210' },
    });
    expect(h.updates[0]?.data).toMatchObject({ contactPhone: '+919876543210' });
  });

  it('normalises before it checks, so one number cannot be asked about two ways', async () => {
    const h = setup();

    await h.service.update('dealer-1', { contact: { phone: '+91 98765-43210' } });

    // The unique index is over the stored string; the read in front of it has
    // to ask about the same string the write will store.
    expect(h.phoneLookups).toEqual(['+919876543210']);
  });

  it('refuses a number another user already holds, naming the field', async () => {
    const h = setup({ phoneHolder: { id: 'someone-else' } });

    await expect(
      h.service.update('dealer-1', { contact: { phone: '9876543210' } }),
    ).rejects.toMatchObject({ code: 'PHONE_ALREADY_REGISTERED' });

    expect(h.updates).toEqual([]);
    expect(h.userUpdates).toEqual([]);
  });

  it('lets the owner re-save the number they already hold', async () => {
    const h = setup({ phoneHolder: { id: 'user-1' } });

    await h.service.update('dealer-1', { contact: { phone: '9876543210' } });

    expect(h.updates[0]?.data).toMatchObject({ contactPhone: '+919876543210' });
  });

  it('touches no user row when the dealership has no owner', async () => {
    const h = setup({ dealer: { members: [] } });

    await h.service.update('dealer-1', { contact: { fullName: 'Nobody' } });

    expect(h.userUpdates).toEqual([]);
  });

  it('flattens the address into its columns', async () => {
    const h = setup();

    await h.service.update('dealer-1', {
      address: {
        line: '99 New Road',
        city: 'Chennai',
        district: 'Chengalpattu',
        state: 'Tamil Nadu',
        pincode: '632002',
        mapsUrl: 'https://maps.app.goo.gl/moved-the-pin',
      },
    });

    expect(h.updates[0]?.data).toEqual({
      addressLine: '99 New Road',
      city: 'Chennai',
      district: 'Chengalpattu',
      state: 'Tamil Nadu',
      pincode: '632002',
      // Stored verbatim — the host was checked by the schema, and what is
      // inside a share link is Google's business.
      mapsUrl: 'https://maps.app.goo.gl/moved-the-pin',
      // A short link carries no coordinates and this fake follows nothing, so
      // the pin is cleared. That is the point: a dealership that has moved must
      // not keep the previous yard's coordinates on its portfolio — and the
      // same argument clears the place it used to name.
      lat: null,
      lng: null,
      mapsPlaceId: null,
    });
  });

  /**
   * The pin is read out of the link, and only ever out of the link.
   *
   * `Chennai, Tamil Nadu` is in the same payload and is not consulted: an
   * address is several gates in one district, and a map centred on the wrong
   * one is worse than no map because it looks authoritative.
   */
  it('writes the pin the dealer’s link resolved to', async () => {
    const h = setup({ geo: { lat: 12.9165, lng: 79.1325 } });

    await h.service.update('dealer-1', {
      address: { mapsUrl: 'https://maps.app.goo.gl/moved-the-pin' },
    });

    expect(h.updates[0]?.data).toMatchObject({ lat: 12.9165, lng: 79.1325 });
    expect(h.mapsLookups).toEqual(['https://maps.app.goo.gl/moved-the-pin']);
  });

  /**
   * The place id costs a redirect to discover, which is the only reason it is
   * stored at all — a link that already carries it has it read back out at
   * request time. So the one shape that needs the column is the one this
   * covers: a short link, followed, and what came back kept.
   */
  it('writes the place the dealer’s link named, alongside the pin', async () => {
    const h = setup({
      geo: { lat: 12.9165, lng: 79.1325 },
      placeId: '0x3bad1234:0x5678beef',
    });

    await h.service.update('dealer-1', {
      address: { mapsUrl: 'https://maps.app.goo.gl/moved-the-pin' },
    });

    expect(h.updates[0]?.data).toMatchObject({
      lat: 12.9165,
      lng: 79.1325,
      mapsPlaceId: '0x3bad1234:0x5678beef',
    });
  });

  /**
   * A dealer editing their opening hours should not pay a round trip to Google
   * for it — and a link that resolved once resolves to the same place.
   */
  it('does not re-resolve a link that did not change', async () => {
    const h = setup();

    await h.service.update('dealer-1', {
      tagline: 'Now open on Sundays',
      address: { mapsUrl: 'https://maps.app.goo.gl/sri-lakshmi-motors' },
    });

    expect(h.mapsLookups).toEqual([]);
    expect(h.updates[0]?.data).not.toHaveProperty('lat');
  });

  it('leaves the pin alone when the address is not being edited', async () => {
    const h = setup();

    await h.service.update('dealer-1', { tagline: 'Now open on Sundays' });

    expect(h.mapsLookups).toEqual([]);
    expect(h.updates[0]?.data).not.toHaveProperty('lat');
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
    expect(presigned.uploadUrl).toContain(
      `${DEALER_ROOT}/documents/GST_CERTIFICATE/${presigned.documentId}`,
    );
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

    // A presign that was never followed by a PUT must not leave a document
    // looking complete.
    await expect(
      h.service.commitDocument('dealer-1', 'GST_CERTIFICATE', { documentId: 'doc-1' }),
    ).rejects.toThrow(DomainError);
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

    // The object's key ends in the row's id. The baseline deleted the *prefix*
    // — the `GST_CERTIFICATE` folder — which is a path no object occupies, so
    // every removed document stayed in storage.
    expect(h.deletes).toEqual([`${DEALER_ROOT}/documents/GST_CERTIFICATE/doc-1`]);
  });

  it('404s when there was nothing to delete, and touches storage not at all', async () => {
    const h = setup({ documentByType: null });

    await expect(h.service.deleteDocument('dealer-1', 'GST_CERTIFICATE')).rejects.toThrow(
      NotFoundError,
    );
    expect(h.deletes).toEqual([]);
  });
});

/**
 * C3 — the one derivation the wizard and the submit endpoint must agree on.
 *
 * These cases pin the two things that are easy to get subtly wrong: which
 * document states count as outstanding, and the fact that the review step is
 * excluded from `isComplete`. Get the second wrong and submitting requires
 * having already submitted.
 */
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

    // The stepper renders these verbatim, so a vague "incomplete" would leave
    // the dealer clicking around looking for the field.
    expect(account?.missing).toEqual(['fullName', 'email']);
    expect(account?.complete).toBe(false);
  });

  it('names every missing business field', async () => {
    const h = setup({
      documents: verified,
      dealer: {
        legalName: null,
        addressLine: null,
        city: null,
        district: null,
        state: null,
        pincode: null,
        mapsUrl: null,
        gstin: null,
        pan: null,
      },
    });

    // `brandName` is not named, and is not checked: it is the server-written
    // mirror of `legalName`, so it can only be missing when `legalName` is, and
    // naming both would ask a dealer to fill in a field that does not exist.
    expect((await h.service.completeness('dealer-1')).steps[1]?.missing).toEqual([
      'legalName',
      'addressLine',
      'city',
      'district',
      'state',
      'pincode',
      // The directions link, named for the same reason the yard photograph is:
      // the public portfolio is "here is the yard, here is how to reach it".
      'mapsUrl',
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

  it('404s a dealership that no longer exists', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.completeness('dealer-1')).rejects.toThrow(NotFoundError);
  });
});

/**
 * C4 — the one transition a dealer makes themselves.
 *
 * Everything worth asserting here is a refusal or a durability guarantee: it
 * happens once, it does not happen at all when the profile is incomplete, and
 * the notification is exactly as durable as the state change because both are
 * one row apiece in the same transaction.
 */
describe('submitForVerification', () => {
  const verified = [
    doc({ type: 'GST_CERTIFICATE', status: 'VERIFIED' }),
    doc({ type: 'PAN_CARD', status: 'VERIFIED' }),
    doc({ type: 'ADDRESS_PROOF', status: 'VERIFIED' }),
  ];

  it('moves a complete draft to PENDING_APPROVAL', async () => {
    const h = setup({ documents: verified, dealer: { status: 'DRAFT' } });

    const response = await h.service.submitForVerification('dealer-1');

    // `statusReason` is cleared on the way in: it holds the note an admin sent
    // the application back with, and leaving it would show the dealer a
    // complaint they have already answered — and, since it is what marks a
    // returned application, reopen the wizard at step one for no reason.
    expect(h.updates[0]?.data).toEqual({ status: 'PENDING_APPROVAL', statusReason: null });
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

  it('404s a dealership that no longer exists', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.submitForVerification('dealer-1')).rejects.toThrow(NotFoundError);
  });
});

/**
 * Two dealerships in one city must not share a registered name, and no two
 * anywhere may share a GSTIN.
 *
 * The unique indexes on `(legalName, city)` and `gstin` are what actually
 * guarantee it, and they are what makes it safe against two applications
 * racing. What is asserted here is the other half of the job: turning a
 * collision into a message against the field the dealer just typed, rather
 * than a Prisma `P2002` the error handler renders as a 500.
 */
describe('update — the duplicate guard', () => {
  it('refuses a registered name another dealership in the same city holds', async () => {
    const h = setup({ conflicting: { legalName: true, gstin: false, pan: false } });

    await expect(
      h.service.update('dealer-1', { legalName: 'Sri Lakshmi Motors Pvt Ltd' }),
    ).rejects.toMatchObject({ status: 409, code: 'DEALER_NAME_TAKEN' });
    expect(h.updates).toEqual([]);
  });

  /** The dealer is told which town it is taken in — the name alone is fine. */
  it('names the city in the refusal', async () => {
    const h = setup({ conflicting: { legalName: true, gstin: false, pan: false } });

    await expect(h.service.update('dealer-1', { legalName: 'Velavan Cars' })).rejects.toMatchObject(
      {
        detail: 'A dealership called Velavan Cars is already registered in Vellore.',
        errors: [
          {
            field: 'body.legalName',
            code: 'DEALER_NAME_TAKEN',
            message: 'Already registered in Vellore.',
          },
        ],
      },
    );
  });

  it('refuses a GSTIN another dealership already holds', async () => {
    const h = setup({ conflicting: { legalName: false, gstin: true, pan: false } });

    await expect(h.service.update('dealer-1', { gstin: '33AABCS1429B1ZX' })).rejects.toMatchObject({
      status: 409,
      code: 'GSTIN_ALREADY_REGISTERED',
    });
    expect(h.updates).toEqual([]);
  });

  /** **R38.** The same rule as the GSTIN above it, and the same shape. */
  it('refuses a PAN another dealership already holds', async () => {
    const h = setup({ conflicting: { legalName: false, gstin: false, pan: true } });

    await expect(h.service.update('dealer-1', { pan: 'AABCS1429B' })).rejects.toMatchObject({
      status: 409,
      code: 'PAN_ALREADY_REGISTERED',
      detail: 'That PAN is already registered to another dealership.',
      errors: [
        { field: 'body.pan', code: 'PAN_ALREADY_REGISTERED', message: 'Already registered.' },
      ],
    });
    // The refusal happens before the write, so nothing was saved.
    expect(h.updates).toEqual([]);
  });

  /**
   * Both duplicated at once is answered about the GSTIN. One field error at a
   * time is the shape of every check on this path, and a GSTIN embeds the PAN
   * of the entity that holds it — so naming the derived field first would send
   * the dealer to the wrong document.
   */
  it('names the GSTIN when the GSTIN and the PAN both collide', async () => {
    const h = setup({ conflicting: { legalName: false, gstin: true, pan: true } });

    await expect(
      h.service.update('dealer-1', { gstin: '33AABCS1429B1ZX', pan: 'AABCS1429B' }),
    ).rejects.toMatchObject({ code: 'GSTIN_ALREADY_REGISTERED' });
  });

  /** A PAN nobody holds is written, and the check saw it. */
  it('asks about the PAN it is being sent', async () => {
    const h = setup();

    await h.service.update('dealer-1', { pan: 'AABCS1429B' });

    expect(h.conflictQueries).toEqual([{ dealerId: 'dealer-1', fields: { pan: 'AABCS1429B' } }]);
    expect(h.updates[0]?.data).toMatchObject({ pan: 'AABCS1429B' });
  });

  /** The dealership asking is excluded, or saving an unchanged form would 409. */
  it('asks only about the fields being changed, ignoring itself', async () => {
    const h = setup();

    await h.service.update('dealer-1', { legalName: 'Velavan Cars', tagline: 'Since 1998' });

    // The city comes from the dealership, because a rename that does not move
    // it is still a rename *within* a city.
    expect(h.conflictQueries).toEqual([
      { dealerId: 'dealer-1', fields: { legalName: 'Velavan Cars', city: 'Vellore' } },
    ]);
  });

  /**
   * A dealer changing name and town in one submit must be checked against the
   * pair they typed. Checking the new name against the old city would refuse a
   * move that is perfectly legal, and — worse — let through one that is not.
   */
  it('checks a rename against the city the same patch moves to', async () => {
    const h = setup();

    await h.service.update('dealer-1', {
      legalName: 'Velavan Cars',
      address: { city: 'salem' },
    });

    expect(h.conflictQueries).toEqual([
      { dealerId: 'dealer-1', fields: { legalName: 'Velavan Cars', city: 'Salem' } },
    ]);
  });

  /**
   * A name with no city to place it in cannot collide with anything, so it is
   * not asked about. The index permits many NULL cities for exactly this row.
   */
  it('does not ask about a name when the dealership has no city yet', async () => {
    const h = setup({ dealer: { city: null } });

    await h.service.update('dealer-1', { legalName: 'Velavan Cars' });

    expect(h.conflictQueries).toEqual([{ dealerId: 'dealer-1', fields: {} }]);
    expect(h.updates[0]?.data).toMatchObject({ legalName: 'Velavan Cars' });
  });

  /**
   * One name. `brandName` is not in `UpdateDealerInput` at all — it is the
   * display mirror, written here so the two cannot disagree.
   */
  it('mirrors the registered name onto the display name', async () => {
    const h = setup();

    await h.service.update('dealer-1', { legalName: 'Velavan Cars' });

    expect(h.updates[0]?.data).toMatchObject({
      legalName: 'Velavan Cars',
      brandName: 'Velavan Cars',
    });
  });
});

/**
 * The city is text the dealer typed, so the only thing standing between five
 * spellings of one town and five facets is the normalisation on the way in.
 * It happens here rather than at read time, in the package both apps import.
 */
describe('update — the locality', () => {
  it('normalises case and spacing before writing either field', async () => {
    const h = setup();

    await h.service.update('dealer-1', {
      address: { city: '  KRISHNAGIRI ', state: 'tamil   nadu' },
    });

    expect(h.updates[0]?.data).toMatchObject({ city: 'Krishnagiri', state: 'Tamil Nadu' });
  });

  it('accepts a city in a state the platform has never seen before', async () => {
    const h = setup();

    // The point of the change. `cities` held five towns in one state, so this
    // dealership could not be described by the product at all.
    await h.service.update('dealer-1', { address: { city: 'Hubballi', state: 'Karnataka' } });

    expect(h.updates[0]?.data).toMatchObject({ city: 'Hubballi', state: 'Karnataka' });
  });

  it('leaves both columns alone when the patch names neither', async () => {
    const h = setup();

    await h.service.update('dealer-1', { address: { line: '99 New Road' } });

    expect(h.updates[0]?.data).toEqual({ addressLine: '99 New Road' });
  });
});

/**
 * R18 — the services box is one comma-separated field, and "Finance, finance"
 * is a slip. It is collapsed on the way in rather than refused, for the reason
 * a locality is normalised rather than refused: the dealer's intent is not in
 * doubt, and two entries differing only in case are one service to a filter,
 * one chip on a card, and two React children with the same key.
 */
describe('update — the services', () => {
  it('collapses entries that differ only in case or spacing', async () => {
    const h = setup();

    await h.service.update('dealer-1', {
      specialities: ['Finance', 'finance', 'RC  transfer', 'rc transfer'],
    });

    expect(h.updates[0]?.data).toMatchObject({ specialities: ['Finance', 'RC transfer'] });
  });

  it('keeps the dealer’s own spelling and order', async () => {
    const h = setup();

    await h.service.update('dealer-1', {
      specialities: ['RC Transfer', 'Exchange', 'rc transfer'],
    });

    expect(h.updates[0]?.data).toMatchObject({ specialities: ['RC Transfer', 'Exchange'] });
  });

  /** A patch that does not carry the field must not clear the column. */
  it('leaves the column alone when the patch names no services', async () => {
    const h = setup();

    await h.service.update('dealer-1', { tagline: 'Trusted since 1998' });

    expect(h.updates[0]?.data).toEqual({ tagline: 'Trusted since 1998' });
  });

  /** An empty list is a dealer clearing the field, not a patch that omitted it. */
  it('writes an empty list through', async () => {
    const h = setup();

    await h.service.update('dealer-1', { specialities: [] });

    expect(h.updates[0]?.data).toMatchObject({ specialities: [] });
  });
});

/**
 * The yard photograph — the hero of the dealership's public portfolio.
 *
 * Same presign → PUT → commit pipeline as the KYC documents, under a different
 * prefix, and with the replacement happening at the opposite end of it: nothing
 * is displaced until commit, so a dealer who changes their mind halfway through
 * picking a file still has the photograph they had before.
 */
describe('yardPhoto', () => {
  it('reads empty when nothing has been uploaded', async () => {
    const h = setup({ dealer: { coverMediaId: null } });

    expect(await h.service.yardPhoto('dealer-1')).toEqual({
      mediaId: null,
      status: null,
      fileName: null,
      url: null,
      uploadedAt: null,
    });
  });

  /** A cover id pointing at a row that is gone is empty, not an error. */
  it('reads empty when the media row has vanished', async () => {
    const h = setup({ media: null });

    expect((await h.service.yardPhoto('dealer-1')).mediaId).toBeNull();
  });

  /**
   * A signed read of the original, not a delivery URL: the derivative pipeline
   * that gives an image a permanent public URL is F034, and until it lands the
   * original is the only copy there is.
   */
  it('signs a short-lived read of the stored object', async () => {
    const h = setup({ media: media() });

    expect(await h.service.yardPhoto('dealer-1')).toMatchObject({
      mediaId: 'media-1',
      fileName: 'yard.jpg',
      url: `https://storage.test/signed/${DEALER_ROOT}/yard/media-1?ttl=300`,
      uploadedAt: '2026-09-01T00:00:00.000Z',
    });
  });

  /** `ORPHAN` is a stored status with no place in the wire enum. */
  it('reports a pending upload as PROCESSING rather than PENDING', async () => {
    const h = setup({ media: media({ status: 'PENDING' }) });

    expect((await h.service.yardPhoto('dealer-1')).status).toBe('PROCESSING');
  });
});

describe('presignYardPhoto', () => {
  it('keys the image under the dealership, beside its documents', async () => {
    const h = setup();

    const presigned = await h.service.presignYardPhoto('dealer-1', {
      fileName: 'yard.jpg',
      mimeType: 'image/jpeg',
      bytes: 184_210,
    });

    const created = h.mediaCreated[0];
    expect(created).toMatchObject({
      dealerId: 'dealer-1',
      ownerType: 'DEALER_COVER',
      status: 'PENDING',
      fileName: 'yard.jpg',
    });
    expect(created?.storageKey).toBe(`${DEALER_ROOT}/yard/${String(created?.id)}`);
    expect(presigned.mediaId).toBe(created?.id);
  });

  /** Presigning displaces nothing — that is what makes an abandoned pick safe. */
  it('leaves the photograph already on the record alone', async () => {
    const h = setup({ media: media() });

    await h.service.presignYardPhoto('dealer-1', {
      fileName: 'new.jpg',
      mimeType: 'image/jpeg',
      bytes: 1000,
    });

    expect(h.deletes).toEqual([]);
    expect(h.orphaned).toEqual([]);
    expect(h.updates).toEqual([]);
  });
});

describe('commitYardPhoto', () => {
  it('refuses an upload that never landed in storage', async () => {
    const h = setup({ media: media({ id: 'media-2' }), head: null });

    await expect(
      h.service.commitYardPhoto('dealer-1', { mediaId: 'media-2' }),
    ).rejects.toMatchObject({ code: 'UPLOAD_MISSING' });
    expect(h.updates).toEqual([]);
  });

  it('refuses a media row belonging to another dealership', async () => {
    const h = setup({ media: media({ dealerId: 'dealer-2' }) });

    await expect(h.service.commitYardPhoto('dealer-1', { mediaId: 'media-1' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('refuses a media row that is not a cover image', async () => {
    const h = setup({ media: media({ ownerType: 'VEHICLE' }) });

    await expect(h.service.commitYardPhoto('dealer-1', { mediaId: 'media-1' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('adopts the upload onto the dealership', async () => {
    const h = setup({
      dealer: { coverMediaId: null },
      media: media(),
      head: { bytes: 184_210, contentType: 'image/jpeg' },
    });

    await h.service.commitYardPhoto('dealer-1', { mediaId: 'media-1' });

    expect(h.updates[0]).toEqual({ dealerId: 'dealer-1', data: { coverMediaId: 'media-1' } });
  });

  /**
   * The promotion the public pages depend on.
   *
   * `media.serve()` answers only for a READY row, and the only thing that
   * promotes one is **F034**'s derivative worker — which does not exist, and
   * whose `media.process` job nothing consumes. So every yard photograph ever
   * uploaded sat at PENDING and the directory had no image to show, even for an
   * approved dealership.
   *
   * The object has just been HEADed, so this is not optimism: the bytes are
   * known to be there, and `serve()` falls back to the original for a row with
   * no variants yet. F034 adds the renditions and `serve()` prefers them; this
   * line does not change when it lands.
   */
  it('marks the upload servable, because nothing else will', async () => {
    const h = setup({
      dealer: { coverMediaId: null },
      media: media({ status: 'PENDING' }),
      head: { bytes: 184_210, contentType: 'image/jpeg' },
    });

    await h.service.commitYardPhoto('dealer-1', { mediaId: 'media-1' });

    expect(h.readied).toEqual(['media-1']);
  });

  /** A commit that never gets past the HEAD promotes nothing. */
  it('leaves an incomplete upload where it is', async () => {
    const h = setup({ dealer: { coverMediaId: null }, media: media(), head: null });

    await expect(h.service.commitYardPhoto('dealer-1', { mediaId: 'media-1' })).rejects.toThrow(
      DomainError,
    );
    expect(h.readied).toEqual([]);
    expect(h.updates).toEqual([]);
  });

  /**
   * This is where a replacement takes effect. The displaced row is marked
   * ORPHAN rather than deleted — it is the only record the bytes ever existed,
   * and a sweeper reconciles orphans against storage.
   */
  it('discards the photograph it displaces', async () => {
    const h = setup({
      dealer: { coverMediaId: 'media-old' },
      media: [
        media({ id: 'media-old', storageKey: `${DEALER_ROOT}/yard/media-old` }),
        media({ id: 'media-new', storageKey: `${DEALER_ROOT}/yard/media-new` }),
      ],
      head: { bytes: 1, contentType: 'image/jpeg' },
    });

    await h.service.commitYardPhoto('dealer-1', { mediaId: 'media-new' });

    expect(h.updates[0]?.data).toEqual({ coverMediaId: 'media-new' });
    expect(h.orphaned).toEqual(['media-old']);
    expect(h.deletes).toEqual([`${DEALER_ROOT}/yard/media-old`]);
  });

  /**
   * Committing the row that is already on the record is a no-op, not a
   * self-destruct. Without the identity check it would delete the object it had
   * just adopted.
   */
  it('does not discard the photograph it is re-committing', async () => {
    const h = setup({
      dealer: { coverMediaId: 'media-1' },
      media: media(),
      head: { bytes: 1, contentType: 'image/jpeg' },
    });

    await h.service.commitYardPhoto('dealer-1', { mediaId: 'media-1' });

    expect(h.deletes).toEqual([]);
    expect(h.orphaned).toEqual([]);
  });
});

describe('deleteYardPhoto', () => {
  it('clears the record and removes the bytes', async () => {
    const h = setup({ media: media() });

    await h.service.deleteYardPhoto('dealer-1');

    expect(h.updates[0]).toEqual({ dealerId: 'dealer-1', data: { coverMediaId: null } });
    expect(h.orphaned).toEqual(['media-1']);
    expect(h.deletes).toEqual([`${DEALER_ROOT}/yard/media-1`]);
  });

  it('404s when there is no photograph to remove', async () => {
    const h = setup({ dealer: { coverMediaId: null } });

    await expect(h.service.deleteYardPhoto('dealer-1')).rejects.toThrow(NotFoundError);
    expect(h.updates).toEqual([]);
  });

  /** A dangling cover id still clears; there is simply nothing to delete. */
  it('clears a cover id whose media row has vanished', async () => {
    const h = setup({ media: null });

    await h.service.deleteYardPhoto('dealer-1');

    expect(h.updates[0]?.data).toEqual({ coverMediaId: null });
    expect(h.deletes).toEqual([]);
  });
});

/**
 * The yard photograph is required, and it is required on the documents step —
 * the step where a dealer uploads things. A dealership whose public storefront
 * would open with an empty frame is not ready to be reviewed.
 */
describe('completeness — the yard photograph', () => {
  const verified = [
    doc({ type: 'GST_CERTIFICATE', status: 'VERIFIED' }),
    doc({ type: 'PAN_CARD', status: 'VERIFIED' }),
    doc({ type: 'ADDRESS_PROOF', status: 'VERIFIED' }),
  ];

  it('names it as outstanding when there is none', async () => {
    const h = setup({ documents: verified, dealer: { coverMediaId: null } });

    const state = await h.service.completeness('dealer-1');

    expect(state.steps[2]?.missing).toEqual(['YARD_PHOTO']);
    expect(state.steps[2]?.complete).toBe(false);
    expect(state.isComplete).toBe(false);
  });

  it('refuses the submit until one is uploaded', async () => {
    const h = setup({
      documents: verified,
      dealer: { status: 'DRAFT', coverMediaId: null },
    });

    await expect(h.service.submitForVerification('dealer-1')).rejects.toMatchObject({
      code: 'PROFILE_INCOMPLETE',
    });
  });
});
