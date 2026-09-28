import { describe, expect, it, vi } from 'vitest';

import {
  locationOf,
  toAdminListingRow,
} from '../../../../src/modules/moderation/moderation.mapper.js';
import type { QueueRow } from '../../../../src/modules/moderation/moderation.repository.js';
import {
  createModerationRepository,
  isOldestFirst,
  sortKeyOf,
} from '../../../../src/modules/moderation/moderation.repository.js';
import { createModerationRouter } from '../../../../src/modules/moderation/moderation.routes.js';
import { createModerationService } from '../../../../src/modules/moderation/moderation.service.js';
import { permissionsOn, routeFor, signaturesOf, validatedSources } from '../../../router-probe.js';

const SUBMITTED = new Date('2026-09-26T09:00:00.000Z');

function queueRow(overrides: Partial<QueueRow> = {}): QueueRow {
  return {
    id: 'listing-1',
    vehicleId: 'vehicle-1',
    dealerId: 'dealer-1',
    status: 'PENDING_REVIEW',
    submittedAt: SUBMITTED,
    lastSubmittedAt: SUBMITTED,
    submissionCount: 1,
    publishedAt: null,
    soldAt: null,
    reservedAt: null,
    withdrawnAt: null,
    withdrawalReason: null,
    withdrawalNote: null,
    decisionReason: null,
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date('2026-09-20T00:00:00.000Z'),
    updatedAt: new Date('2026-09-25T00:00:00.000Z'),
    vehicle: {
      id: 'vehicle-1',
      registrationNumber: 'KA01AB1234',
      make: 'Hyundai',
      model: 'Creta',
      variant: null,
      manufacturingYear: 2023,
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      kilometersDriven: 22_400,
      pricePaise: 145_000_000n,
      photography: null,
      _count: { images: 3 },
    },
    dealer: {
      id: 'dealer-1',
      brandName: 'Sri Lakshmi Motors',
      slug: 'sri',
      city: 'Vellore',
      district: 'Vellore',
    },
    ...overrides,
  } as unknown as QueueRow;
}

describe('the admin listing row', () => {
  it('names the car, the dealership and how long it has waited', () => {
    const row = toAdminListingRow(queueRow(), new Date('2026-09-26T12:00:00.000Z'));
    expect(row).toMatchObject({
      title: '2023 Hyundai Creta',
      registrationDisplay: 'KA 01 AB 1234',
      priceLabel: '₹14,50,000',
      dealer: { id: 'dealer-1', name: 'Sri Lakshmi Motors', slug: 'sri' },
      location: 'Vellore',
      waitingLabel: '3 hours ago',
      resubmission: false,
      imageCount: 3,
    });
  });

  it('says nothing about waiting once a listing is out of the queue', () => {
    expect(toAdminListingRow(queueRow({ status: 'ACTIVE' })).waitingLabel).toBeNull();
  });

  it('reports photography as not started until the team records otherwise', () => {
    expect(toAdminListingRow(queueRow()).photography).toEqual({
      status: 'NOT_STARTED',
      label: 'Not photographed',
      tone: 'neutral',
    });
    const ready = queueRow({
      vehicle: { ...queueRow().vehicle, photography: { status: 'READY' } },
    } as never);
    expect(toAdminListingRow(ready).photography).toMatchObject({ status: 'READY', tone: 'ok' });
  });

  it('marks a second submission as a resubmission', () => {
    expect(toAdminListingRow(queueRow({ submissionCount: 2 })).resubmission).toBe(true);
  });

  it('shows a draft that was never submitted without a date or a price', () => {
    const row = toAdminListingRow(
      queueRow({
        status: 'DRAFT',
        lastSubmittedAt: null,
        vehicle: {
          ...queueRow().vehicle,
          pricePaise: null,
          make: null,
          model: null,
          manufacturingYear: null,
        },
      }),
    );
    expect(row).toMatchObject({ title: 'KA 01 AB 1234', priceLabel: null, submittedAt: null });
  });

  it('joins town and district once each, and says nothing when neither is known', () => {
    expect(locationOf({ city: 'Katpadi', district: 'Vellore' })).toBe('Katpadi, Vellore');
    expect(locationOf({ city: 'Vellore', district: 'Vellore' })).toBe('Vellore');
    expect(locationOf({ city: null, district: null })).toBeNull();
  });
});

describe('ordering', () => {
  it('works the review queue oldest first and every other status newest first', () => {
    expect(isOldestFirst('PENDING_REVIEW')).toBe(true);
    expect(isOldestFirst('ACTIVE')).toBe(false);
    expect(sortKeyOf(queueRow())).toEqual(SUBMITTED);
    expect(sortKeyOf(queueRow({ status: 'ACTIVE' }))).toEqual(queueRow().updatedAt);
    expect(sortKeyOf(queueRow({ lastSubmittedAt: null }))).toEqual(queueRow().createdAt);
  });

  it('asks the database for the queue in that order, after a cursor', async () => {
    const findMany = vi.fn(async () => []);
    const repo = createModerationRepository({ listing: { findMany } } as never);

    await repo.queue({ status: 'PENDING_REVIEW', after: SUBMITTED, take: 5 });
    await repo.queue({ status: 'SOLD', after: SUBMITTED, take: 5, q: 'ka-01' });

    expect(findMany.mock.calls[0]).toMatchObject([
      {
        where: { status: 'PENDING_REVIEW', lastSubmittedAt: { gt: SUBMITTED } },
        orderBy: [{ lastSubmittedAt: 'asc' }, { id: 'asc' }],
        take: 5,
      },
    ]);
    expect(findMany.mock.calls[1]).toMatchObject([
      {
        where: { status: 'SOLD', updatedAt: { lt: SUBMITTED } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      },
    ]);
  });
});

describe('the service', () => {
  it('defaults to the review queue and pages with a cursor on its sort key', async () => {
    const repo = {
      queue: vi.fn(async () => [queueRow(), queueRow({ id: 'listing-2' })]),
      statusCounts: vi.fn(async () => [{ status: 'PENDING_REVIEW' as const, count: 2 }]),
    };
    const service = createModerationService({
      repo: { ...repo, detail: vi.fn(), history: vi.fn() },
      prisma: {} as never,
      audit: { record: vi.fn(), recordDetached: vi.fn() },
      images: { images: vi.fn(), minimum: vi.fn() },
    });
    const response = await service.listings({ limit: 1 });

    expect(repo.queue).toHaveBeenCalledWith({ status: 'PENDING_REVIEW', take: 2 });
    expect(response.status).toBe('PENDING_REVIEW');
    expect(response.data).toHaveLength(1);
    expect(response.page.hasMore).toBe(true);
    expect(response.page.nextCursor).toBe(
      Buffer.from(SUBMITTED.toISOString()).toString('base64url'),
    );
    expect(response.counts).toEqual({ PENDING_REVIEW: 2 });
  });
});

describe('the router', () => {
  const router = createModerationRouter({} as never);

  it('declares the queue, the review and the checklist', () => {
    expect(signaturesOf(router)).toEqual([
      'GET /listings',
      'GET /listings/:id',
      'PUT /listings/:id/checks/:key',
      'PUT /listings/:id/photography',
      'POST /listings/:id/request-changes',
      'POST /listings/:id/reject',
      'POST /listings/:id/approve',
    ]);
  });

  it.each([
    'GET /listings',
    'GET /listings/:id',
    'PUT /listings/:id/checks/:key',
    'PUT /listings/:id/photography',
    'POST /listings/:id/request-changes',
    'POST /listings/:id/reject',
    'POST /listings/:id/approve',
  ])('guards %s with the moderation permission', (signature) => {
    expect(permissionsOn(routeFor(router, signature) as never)).toEqual(['admin:listing:moderate']);
  });

  it.each(['POST /listings/:id/request-changes', 'POST /listings/:id/reject'])(
    'parses the id and the reason on %s',
    (signature) => {
      expect(validatedSources(routeFor(router, signature) as never)).toEqual(
        expect.arrayContaining(['params', 'body']),
      );
    },
  );

  it('parses what each route reads', () => {
    expect(validatedSources(routeFor(router, 'GET /listings') as never)).toContain('query');
    expect(validatedSources(routeFor(router, 'GET /listings/:id') as never)).toContain('params');
    expect(validatedSources(routeFor(router, 'PUT /listings/:id/checks/:key') as never)).toEqual(
      expect.arrayContaining(['params', 'body']),
    );
  });
});
