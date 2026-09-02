import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { env } from '../../../../src/config/env.js';
import type { MediaService } from '../../../../src/modules/media/media.service.js';
import type { SearchRepository } from '../../../../src/modules/search/search.repository.js';
import type {
  DomainEvent,
  DomainEventType,
  EventBus,
  EventHandler,
} from '../../../../src/platform/events/bus.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';
import { registerHandlers, registerSchedules } from '../../../../src/platform/jobs/handlers.js';
import type { JobName, Queue } from '../../../../src/platform/jobs/queue.js';
import type { MailMessage, SmsMessage } from '../../../../src/platform/notify/notify.port.js';
import { logger } from '../../../../src/platform/telemetry/logger.js';

/**
 * Unit tests for `src/platform/jobs/handlers.ts`.
 *
 * This file is where the asynchronous half of the system is wired: which event
 * queues which job, and what each job does. The integration suite proves the
 * happy paths end to end through `h.drain()`, but it cannot easily reach the
 * defensive branches — a job for an enquiry that was deleted, a dealer with no
 * owner, an owner with no email, a payload with a non-string id — and those are
 * the branches that decide whether a retried job crashes the worker or does
 * nothing. Every handler here is meant to be idempotent and to survive being run
 * twice, so that is what gets exercised.
 */
interface Sent {
  name: JobName;
  data: Record<string, unknown>;
}

/**
 * A hand-rolled prisma stand-in. The delegates are records of methods
 * (`prisma.dealer.findMany`), but `$queryRaw` sits at the top level and is a
 * method itself — so the shape admits both rather than pretending prisma is
 * uniform.
 */
type PrismaMethod = (...args: never[]) => unknown;
type PrismaStub = Record<string, Record<string, PrismaMethod> | PrismaMethod>;

function setup(overrides: { prisma?: PrismaStub } = {}) {
  const sent: Sent[] = [];
  const handlers = new Map<JobName, (data: Record<string, unknown>) => Promise<void>>();
  const subscribers = new Map<DomainEventType, EventHandler[]>();
  const mails: MailMessage[] = [];
  const texts: SmsMessage[] = [];
  const indexed: string[] = [];
  const removed: string[] = [];
  const processed: string[] = [];

  const queue: Queue = {
    send: (name, data) => {
      sent.push({ name, data });
      return Promise.resolve();
    },
    work: (name, handler) => {
      handlers.set(name, handler);
      return Promise.resolve();
    },
    schedule: () => Promise.resolve(),
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
  };

  const bus: EventBus = {
    on: (type, handler) => {
      subscribers.set(type, [...(subscribers.get(type) ?? []), handler]);
    },
    publish: async (candidate) => {
      for (const handler of subscribers.get(candidate.type) ?? []) await handler(candidate);
    },
  };

  const search = {
    index: (listingId: string) => {
      indexed.push(listingId);
      return Promise.resolve();
    },
    remove: (listingId: string) => {
      removed.push(listingId);
      return Promise.resolve();
    },
    listListingIdsForDealer: () => Promise.resolve(['listing-1', 'listing-2']),
  } as unknown as SearchRepository;

  const media = {
    process: (mediaId: string) => {
      processed.push(mediaId);
      return Promise.resolve();
    },
  } as unknown as MediaService;

  const prisma = (overrides.prisma ?? {}) as unknown as PrismaClient;
  const cache = createMemoryCache();

  const deps = {
    prisma,
    queue,
    bus,
    search,
    media,
    mailer: {
      send: (message: MailMessage) => {
        mails.push(message);
        return Promise.resolve();
      },
    },
    sms: {
      send: (message: SmsMessage) => {
        texts.push(message);
        return Promise.resolve();
      },
    },
    cache,
    // Only the RC cache sweep reaches this. Counting calls rather than
    // stubbing a whole repository keeps the assertion about the schedule.
    vehicles: { sweepRcLookups: () => Promise.resolve(0) } as never,
  };

  return {
    deps,
    cache,
    sent,
    mails,
    texts,
    indexed,
    removed,
    processed,
    subscribers,
    async register() {
      await registerHandlers(deps);
    },
    run(name: JobName, data: Record<string, unknown> = {}) {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`no handler registered for ${name}`);
      return handler(data);
    },
    publish(type: DomainEventType, overridesEvent: Partial<DomainEvent> = {}) {
      return bus.publish({
        id: 'event-1',
        type,
        version: 1,
        occurredAt: '2026-08-17T10:00:00.000Z',
        aggregateType: 'Listing',
        aggregateId: 'aggregate-1',
        actor: { type: 'SYSTEM' },
        traceId: 'trace-1',
        payload: {},
        ...overridesEvent,
      });
    },
  };
}

const OWNER = { email: 'owner@sri-lakshmi-motors.in', phone: '9840012345' };

describe('registration', () => {
  it('registers a handler for every job name the queue declares', async () => {
    const handled: JobName[] = [];
    const h = setup();
    h.deps.queue.work = (name, handler) => {
      handled.push(name);
      return Promise.resolve(void handler);
    };

    await registerHandlers(h.deps);

    // `media.gc-orphans` is scheduled but has no handler yet — an honest gap, and
    // one this assertion documents rather than hides.
    expect(handled).toEqual([
      'cache.sweep-counters',
      'rc.sweep-lookups',
      'media.process',
      'search.index-listing',
      'search.remove-listing',
      'search.reindex-dealer',
      'notification.enquiry-to-dealer',
      'notification.listing-reviewed',
      'notification.dealer-reviewed',
      'notification.invoice',
      'listings.expire-sweep',
      'counters.reconcile',
    ]);
  });
});

describe('the id guard on job payloads', () => {
  it('does nothing when the id is missing', async () => {
    const h = setup();
    await h.register();

    await h.run('media.process', {});
    await h.run('search.index-listing', {});
    await h.run('search.remove-listing', {});
    await h.run('search.reindex-dealer', {});

    expect([h.processed, h.indexed, h.removed]).toEqual([[], [], []]);
  });

  it('does nothing when the id is not a string', async () => {
    const h = setup();
    await h.register();

    // `String({})` is `[object Object]`, which would be passed on as an id and
    // fail a lookup somewhere far away from here.
    for (const value of [{}, [], 42, true, null]) {
      await h.run('media.process', { mediaId: value });
      await h.run('search.index-listing', { listingId: value });
    }

    expect([h.processed, h.indexed]).toEqual([[], []]);
  });

  it('acts on a well-formed payload', async () => {
    const h = setup();
    await h.register();

    await h.run('media.process', { mediaId: 'media-1' });
    await h.run('search.index-listing', { listingId: 'listing-1' });
    await h.run('search.remove-listing', { listingId: 'listing-2' });

    expect(h.processed).toEqual(['media-1']);
    expect(h.indexed).toEqual(['listing-1']);
    expect(h.removed).toEqual(['listing-2']);
  });
});

describe('search.reindex-dealer', () => {
  it('reindexes every listing the dealer has', async () => {
    const h = setup();
    await h.register();

    await h.run('search.reindex-dealer', { dealerId: 'dealer-1' });

    // One event, all of that dealer's cars: this is what makes a suspension pull
    // the whole portfolio out of the catalogue at once.
    expect(h.indexed).toEqual(['listing-1', 'listing-2']);
  });
});

describe('notification.enquiry-to-dealer', () => {
  function prismaWith(enquiry: unknown, updates: unknown[] = []) {
    return {
      enquiry: { findUnique: () => Promise.resolve(enquiry) },
      listing: {
        update: (args: unknown) => {
          updates.push(args);
          return Promise.resolve({});
        },
      },
    } satisfies PrismaStub;
  }

  const enquiry = {
    id: 'enquiry-1',
    name: 'Anitha R',
    phone: '9876543210',
    message: 'Is the service history available?',
    reference: 'ENQ-2026-0001',
    status: 'NEW',
    listingId: 'listing-1',
    dealer: {
      contactPhone: '9840012345',
      members: [{ user: OWNER }],
    },
    vehicle: {
      year: 2021,
      make: { name: 'Maruti Suzuki' },
      model: { name: 'Alto 800' },
      variant: { name: 'VXI' },
    },
  };

  it('emails the owner with the buyer’s name, number, message and reference', async () => {
    const h = setup({ prisma: prismaWith(enquiry) });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    expect(h.mails).toHaveLength(1);
    expect(h.mails[0]?.to).toBe(OWNER.email);
    expect(h.mails[0]?.subject).toContain('2021 Maruti Suzuki Alto 800 VXI');
    expect(h.mails[0]?.subject).toContain('ENQ-2026-0001');
    expect(h.mails[0]?.body).toContain('Anitha R');
    expect(h.mails[0]?.body).toContain('9876543210');
    expect(h.mails[0]?.body).toContain('Is the service history available?');
  });

  it('includes a direct link to the inbox', async () => {
    const h = setup({ prisma: prismaWith(enquiry) });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    // §14.5: a tappable number and a direct link. A notification that makes the
    // dealer go hunting is a notification that loses the lead.
    expect(h.mails[0]?.body).toContain(`${env.WEB_BASE_URL}/dealer/enquiries`);
  });

  it('texts the dealership’s contact number', async () => {
    const h = setup({ prisma: prismaWith(enquiry) });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    expect(h.texts).toHaveLength(1);
    expect(h.texts[0]?.to).toBe('9840012345');
    expect(h.texts[0]?.body).toContain('Anitha R');
    expect(h.texts[0]?.body).toContain('ENQ-2026-0001');
  });

  it('omits the message line when the buyer left none', async () => {
    const h = setup({ prisma: prismaWith({ ...enquiry, message: null }) });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    expect(h.mails[0]?.body).not.toContain('Message:');
    expect(h.mails[0]?.body).toContain('Phone:');
  });

  it('falls back to a generic subject when the enquiry names no vehicle', async () => {
    const h = setup({ prisma: prismaWith({ ...enquiry, vehicle: null }) });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    expect(h.mails[0]?.subject).toContain('your dealership');
  });

  it('drops a variant that is not set without leaving a double space', async () => {
    const h = setup({
      prisma: prismaWith({ ...enquiry, vehicle: { ...enquiry.vehicle, variant: null } }),
    });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    expect(h.mails[0]?.subject).toContain('2021 Maruti Suzuki Alto 800');
    expect(h.mails[0]?.subject).not.toMatch(/ {2}/);
  });

  it('increments the listing’s enquiry counter off the request path', async () => {
    const updates: unknown[] = [];
    const h = setup({ prisma: prismaWith(enquiry, updates) });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    expect(updates).toEqual([
      { where: { id: 'listing-1' }, data: { enquiryCount: { increment: 1 } } },
    ]);
  });

  it('skips the counter when the enquiry is not attached to a listing', async () => {
    const updates: unknown[] = [];
    const h = setup({ prisma: prismaWith({ ...enquiry, listingId: null }, updates) });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    expect(updates).toEqual([]);
    expect(h.mails).toHaveLength(1);
  });

  it('sends nothing for an enquiry that no longer exists', async () => {
    const h = setup({ prisma: prismaWith(null) });
    await h.register();

    // A retry after the row was deleted must be a no-op, not a crash.
    await expect(
      h.run('notification.enquiry-to-dealer', { enquiryId: 'gone' }),
    ).resolves.toBeUndefined();
    expect([h.mails, h.texts]).toEqual([[], []]);
  });

  it('sends nothing for an enquiry marked SPAM', async () => {
    const h = setup({ prisma: prismaWith({ ...enquiry, status: 'SPAM' }) });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    expect([h.mails, h.texts]).toEqual([[], []]);
  });

  it('still texts when the dealership has no owner email on file', async () => {
    const h = setup({
      prisma: prismaWith({ ...enquiry, dealer: { ...enquiry.dealer, members: [] } }),
    });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    // Half a notification beats none: the lead is the product.
    expect(h.mails).toEqual([]);
    expect(h.texts).toHaveLength(1);
  });

  it('still emails when the dealership has no contact phone', async () => {
    const h = setup({
      prisma: prismaWith({ ...enquiry, dealer: { ...enquiry.dealer, contactPhone: null } }),
    });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    expect(h.mails).toHaveLength(1);
    expect(h.texts).toEqual([]);
  });

  it('sends nothing when the owner record has no email address', async () => {
    const h = setup({
      prisma: prismaWith({
        ...enquiry,
        dealer: { ...enquiry.dealer, contactPhone: null, members: [{ user: { email: null } }] },
      }),
    });
    await h.register();

    await h.run('notification.enquiry-to-dealer', { enquiryId: 'enquiry-1' });

    expect([h.mails, h.texts]).toEqual([[], []]);
  });
});

describe('notification.listing-reviewed', () => {
  function prismaWith(listing: unknown) {
    return { listing: { findUnique: () => Promise.resolve(listing) } } satisfies PrismaStub;
  }

  const base = {
    id: 'listing-1',
    status: 'APPROVED',
    expiresAt: new Date('2026-11-15T00:00:00.000Z'),
    rejectionReason: null,
    changeRequestNote: null,
    dealer: { members: [{ user: OWNER }] },
    vehicle: { year: 2021, make: { name: 'Maruti Suzuki' }, model: { name: 'Alto 800' } },
  };

  it('tells the dealer when a listing went live, and until when', async () => {
    const h = setup({ prisma: prismaWith(base) });
    await h.register();

    await h.run('notification.listing-reviewed', { listingId: 'listing-1' });

    expect(h.mails[0]?.subject).toBe('Listing update — 2021 Maruti Suzuki Alto 800');
    expect(h.mails[0]?.body).toContain('now live');
    // The date is rendered in the form DESIGN-SPEC §4.14 fixes.
    expect(h.mails[0]?.body).toContain('15 Nov 2026');
  });

  it('says "further notice" when an approved listing has no expiry', async () => {
    const h = setup({ prisma: prismaWith({ ...base, expiresAt: null }) });
    await h.register();

    await h.run('notification.listing-reviewed', { listingId: 'listing-1' });

    expect(h.mails[0]?.body).toContain('further notice');
  });

  it('gives the rejection reason and how to resubmit', async () => {
    const h = setup({
      prisma: prismaWith({
        ...base,
        status: 'REJECTED',
        rejectionReason: 'Odometer photo does not match the declared KM reading.',
      }),
    });
    await h.register();

    await h.run('notification.listing-reviewed', { listingId: 'listing-1' });

    expect(h.mails[0]?.body).toContain('was not approved');
    expect(h.mails[0]?.body).toContain('Odometer photo');
    expect(h.mails[0]?.body).toContain(`${env.WEB_BASE_URL}/dealer/inventory`);
  });

  it('degrades to an em dash rather than "null" when a reason is missing', async () => {
    const h = setup({ prisma: prismaWith({ ...base, status: 'REJECTED' }) });
    await h.register();

    await h.run('notification.listing-reviewed', { listingId: 'listing-1' });

    expect(h.mails[0]?.body).toContain('Reason: —');
    expect(h.mails[0]?.body).not.toContain('null');
  });

  it('passes on the change request note', async () => {
    const h = setup({
      prisma: prismaWith({
        ...base,
        status: 'CHANGES_REQUESTED',
        changeRequestNote: 'Please add an interior photo.',
      }),
    });
    await h.register();

    await h.run('notification.listing-reviewed', { listingId: 'listing-1' });

    expect(h.mails[0]?.body).toContain('needs changes');
    expect(h.mails[0]?.body).toContain('Please add an interior photo.');
  });

  it('uses an em dash for a change request with no note', async () => {
    const h = setup({ prisma: prismaWith({ ...base, status: 'CHANGES_REQUESTED' }) });
    await h.register();

    await h.run('notification.listing-reviewed', { listingId: 'listing-1' });

    expect(h.mails[0]?.body).toContain('Note: —');
  });

  it('sends nothing for a listing that has gone', async () => {
    const h = setup({ prisma: prismaWith(null) });
    await h.register();

    await expect(
      h.run('notification.listing-reviewed', { listingId: 'x' }),
    ).resolves.toBeUndefined();
    expect(h.mails).toEqual([]);
  });

  it('sends nothing when the dealership has no owner with an email', async () => {
    const h = setup({ prisma: prismaWith({ ...base, dealer: { members: [] } }) });
    await h.register();

    await h.run('notification.listing-reviewed', { listingId: 'listing-1' });

    expect(h.mails).toEqual([]);
  });
});

describe('notification.dealer-reviewed', () => {
  function prismaWith(dealer: unknown) {
    return { dealer: { findUnique: () => Promise.resolve(dealer) } } satisfies PrismaStub;
  }

  it('states the new status in human words', async () => {
    const h = setup({
      prisma: prismaWith({
        status: 'ACTIVE',
        statusReason: null,
        members: [{ user: OWNER }],
      }),
    });
    await h.register();

    await h.run('notification.dealer-reviewed', { dealerId: 'dealer-1' });

    expect(h.mails[0]?.subject).toBe('Your dealership is active');
    expect(h.mails[0]?.body).toBe('Status: ACTIVE.');
  });

  it('turns an underscored status into a readable subject', async () => {
    const h = setup({
      prisma: prismaWith({
        status: 'PENDING_VERIFICATION',
        statusReason: null,
        members: [{ user: OWNER }],
      }),
    });
    await h.register();

    await h.run('notification.dealer-reviewed', { dealerId: 'dealer-1' });

    expect(h.mails[0]?.subject).toBe('Your dealership is pending verification');
  });

  it('includes the reason when there is one', async () => {
    const h = setup({
      prisma: prismaWith({
        status: 'SUSPENDED',
        statusReason: 'GST certificate has expired.',
        members: [{ user: OWNER }],
      }),
    });
    await h.register();

    await h.run('notification.dealer-reviewed', { dealerId: 'dealer-1' });

    expect(h.mails[0]?.body).toBe('Status: SUSPENDED. GST certificate has expired.');
  });

  it('sends nothing for a dealership that has gone, or has no owner email', async () => {
    for (const dealer of [null, { status: 'ACTIVE', statusReason: null, members: [] }]) {
      const h = setup({ prisma: prismaWith(dealer) });
      await h.register();

      await h.run('notification.dealer-reviewed', { dealerId: 'dealer-1' });

      expect(h.mails).toEqual([]);
    }
  });
});

describe('notification.invoice', () => {
  function prismaWith(invoice: unknown) {
    return { invoice: { findFirst: () => Promise.resolve(invoice) } } satisfies PrismaStub;
  }

  it('emails the invoice number and the credits added', async () => {
    const h = setup({
      prisma: prismaWith({
        number: 'INV-2026-0007',
        credits: 25,
        dealer: { members: [{ user: OWNER }] },
      }),
    });
    await h.register();

    await h.run('notification.invoice', { orderId: 'order-1' });

    expect(h.mails[0]?.subject).toBe('Invoice INV-2026-0007');
    expect(h.mails[0]?.body).toContain('25 credits added');
    expect(h.mails[0]?.body).toContain('Billing & credits');
  });

  it('sends nothing when no invoice exists for the order yet', async () => {
    const h = setup({ prisma: prismaWith(null) });
    await h.register();

    // The invoice is written in the settlement transaction; a notification that
    // arrived first must wait for the retry rather than fail.
    await expect(h.run('notification.invoice', { orderId: 'order-1' })).resolves.toBeUndefined();
    expect(h.mails).toEqual([]);
  });

  it('sends nothing when the dealership has no owner email', async () => {
    const h = setup({
      prisma: prismaWith({ number: 'INV-1', credits: 1, dealer: { members: [] } }),
    });
    await h.register();

    await h.run('notification.invoice', { orderId: 'order-1' });

    expect(h.mails).toEqual([]);
  });
});

describe('listings.expire-sweep', () => {
  function prismaWith(due: { id: string; dealerId: string }[]) {
    const updates: unknown[] = [];
    const dealerUpdates: unknown[] = [];

    return {
      updates,
      dealerUpdates,
      prisma: {
        listing: {
          findMany: () => Promise.resolve(due),
          update: (args: unknown) => {
            updates.push(args);
            return Promise.resolve({});
          },
          count: () => Promise.resolve(3),
        },
        dealer: {
          update: (args: unknown) => {
            dealerUpdates.push(args);
            return Promise.resolve({});
          },
        },
      } satisfies PrismaStub,
    };
  }

  it('expires each due listing and drops it from the catalogue', async () => {
    const fake = prismaWith([
      { id: 'listing-1', dealerId: 'dealer-1' },
      { id: 'listing-2', dealerId: 'dealer-2' },
    ]);
    const h = setup({ prisma: fake.prisma });
    await h.register();

    await h.run('listings.expire-sweep');

    expect(fake.updates).toEqual([
      { where: { id: 'listing-1' }, data: { status: 'EXPIRED' } },
      { where: { id: 'listing-2' }, data: { status: 'EXPIRED' } },
    ]);
    expect(h.removed).toEqual(['listing-1', 'listing-2']);
  });

  it('recomputes the dealer’s active count from live rows rather than decrementing', async () => {
    const fake = prismaWith([{ id: 'listing-1', dealerId: 'dealer-1' }]);
    const h = setup({ prisma: fake.prisma });
    await h.register();

    await h.run('listings.expire-sweep');

    // A decrement drifts the moment anything else touches the row; a recount
    // cannot.
    expect(fake.dealerUpdates).toEqual([
      { where: { id: 'dealer-1' }, data: { activeListings: 3 } },
    ]);
  });

  it('logs once with a count when anything expired', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const fake = prismaWith([{ id: 'listing-1', dealerId: 'dealer-1' }]);
    const h = setup({ prisma: fake.prisma });
    await h.register();

    await h.run('listings.expire-sweep');

    expect(info).toHaveBeenCalledWith({ count: 1 }, 'listings expired');
    info.mockRestore();
  });

  it('stays quiet on a night when nothing was due', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const fake = prismaWith([]);
    const h = setup({ prisma: fake.prisma });
    await h.register();

    await h.run('listings.expire-sweep');

    // A nightly job that logs every night teaches people to ignore it.
    expect(info).not.toHaveBeenCalled();
    expect(fake.updates).toEqual([]);
    info.mockRestore();
  });
});

describe('counters.reconcile', () => {
  function prismaWith(options: {
    dealers: { id: string; creditBalance: number; creditsHeld: number }[];
    newestBalance?: number | null;
    heldListings?: number;
    orphaned?: bigint;
  }) {
    return {
      dealer: { findMany: () => Promise.resolve(options.dealers) },
      creditTransaction: {
        findFirst: () =>
          Promise.resolve(
            options.newestBalance === null || options.newestBalance === undefined
              ? null
              : { balanceAfter: options.newestBalance },
          ),
      },
      listing: { count: () => Promise.resolve(options.heldListings ?? 0) },
      $queryRaw: () => Promise.resolve([{ count: options.orphaned ?? 0n }]),
    } satisfies PrismaStub;
  }

  it('says nothing when the caches agree with the ledger', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const h = setup({
      prisma: prismaWith({
        dealers: [{ id: 'dealer-1', creditBalance: 39, creditsHeld: 2 }],
        newestBalance: 39,
        heldListings: 2,
      }),
    });
    await h.register();

    await h.run('counters.reconcile');

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('reports ledger drift as an error, because it is money', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const h = setup({
      prisma: prismaWith({
        dealers: [{ id: 'dealer-1', creditBalance: 40, creditsHeld: 0 }],
        newestBalance: 39,
      }),
    });
    await h.register();

    await h.run('counters.reconcile');

    // §26.8: not a warning. The cached balance is what the dealer sees; the
    // ledger is what is true.
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toMatchObject({
      dealerId: 'dealer-1',
      ledgerBalance: 39,
      cached: 40,
    });
    expect(String(error.mock.calls[0]?.[1])).toContain('LEDGER DRIFT');
    error.mockRestore();
  });

  it('treats a dealer with no ledger rows as a zero balance', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const h = setup({
      prisma: prismaWith({
        dealers: [{ id: 'dealer-1', creditBalance: 0, creditsHeld: 0 }],
        newestBalance: null,
      }),
    });
    await h.register();

    await h.run('counters.reconcile');

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('reports held-credit drift against live listings', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const h = setup({
      prisma: prismaWith({
        dealers: [{ id: 'dealer-1', creditBalance: 39, creditsHeld: 5 }],
        newestBalance: 39,
        heldListings: 2,
      }),
    });
    await h.register();

    await h.run('counters.reconcile');

    expect(String(error.mock.calls[0]?.[1])).toContain('HELD-CREDIT DRIFT');
    expect(error.mock.calls[0]?.[0]).toMatchObject({ held: 2, cached: 5 });
    error.mockRestore();
  });

  it('reports an APPROVED listing with no CONSUME_APPROVE row', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const h = setup({ prisma: prismaWith({ dealers: [], orphaned: 4n }) });
    await h.register();

    await h.run('counters.reconcile');

    // A published listing nobody paid for. The credit lifecycle is the revenue
    // model, so this is the check that protects it.
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toEqual({ count: 4 });
    error.mockRestore();
  });

  it('checks every dealer, not just the first', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const h = setup({
      prisma: prismaWith({
        dealers: [
          { id: 'dealer-1', creditBalance: 1, creditsHeld: 0 },
          { id: 'dealer-2', creditBalance: 2, creditsHeld: 0 },
        ],
        newestBalance: 0,
      }),
    });
    await h.register();

    await h.run('counters.reconcile');

    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});

describe('the subscriptions', () => {
  it('indexes an approved listing and notifies the dealer', async () => {
    const h = setup();
    await h.register();

    await h.publish('ListingApproved', { aggregateId: 'listing-1' });

    expect(h.sent).toEqual([
      { name: 'search.index-listing', data: { listingId: 'listing-1' } },
      { name: 'notification.listing-reviewed', data: { listingId: 'listing-1' } },
    ]);
  });

  it('unindexes on every event that takes a car out of the catalogue', async () => {
    // `VehicleSold` is deliberately absent: a sale keeps the row and flips
    // `is_sold`, so the car stays on the marketplace as badged, unclickable
    // proof the dealer moves stock. See the reindex test below.
    const events: DomainEventType[] = [
      'ListingRejected',
      'ListingRemoved',
      'ListingExpired',
      'ListingSubmitted',
    ];

    for (const type of events) {
      const h = setup();
      await h.register();

      await h.publish(type, { aggregateId: 'listing-1' });

      expect(
        h.sent.some((job) => job.name === 'search.remove-listing'),
        `${type} should unindex`,
      ).toBe(true);
    }
  });

  it('reindexes on a sale rather than unindexing, so the sold car stays visible', async () => {
    const h = setup();
    await h.register();

    await h.publish('VehicleSold', { aggregateId: 'listing-1' });

    // `index` re-derives from the listing and sets `is_sold`; `remove` would
    // delete the row and take the car off the marketplace, which is what
    // `ListingRemoved` is for.
    expect(h.sent).toEqual([{ name: 'search.index-listing', data: { listingId: 'listing-1' } }]);
  });

  it('unindexes on submit, because a resubmitted car must leave the catalogue', async () => {
    const h = setup();
    await h.register();

    await h.publish('ListingSubmitted', { aggregateId: 'listing-1' });

    // Rule 6: only APPROVED is visible. A car being re-reviewed is not approved.
    expect(h.sent).toEqual([{ name: 'search.remove-listing', data: { listingId: 'listing-1' } }]);
  });

  it('notifies on a change request without touching the index', async () => {
    const h = setup();
    await h.register();

    await h.publish('ListingChangesRequested', { aggregateId: 'listing-1' });

    expect(h.sent).toEqual([
      { name: 'notification.listing-reviewed', data: { listingId: 'listing-1' } },
    ]);
  });

  it('takes the enquiry id from the payload, falling back to the aggregate', async () => {
    const h = setup();
    await h.register();

    await h.publish('EnquiryCreated', {
      aggregateId: 'aggregate-1',
      payload: { enquiryId: 'enquiry-7' },
    });
    await h.publish('PhoneRevealed', { aggregateId: 'aggregate-2', payload: {} });

    expect(h.sent).toEqual([
      { name: 'notification.enquiry-to-dealer', data: { enquiryId: 'enquiry-7' } },
      { name: 'notification.enquiry-to-dealer', data: { enquiryId: 'aggregate-2' } },
    ]);
  });

  it('reindexes a dealer’s whole portfolio when their status changes', async () => {
    for (const type of ['DealerSuspended', 'DealerRejected', 'DealerReinstated'] as const) {
      const h = setup();
      await h.register();

      await h.publish(type, { aggregateId: 'dealer-1' });

      expect(
        h.sent.some(
          (job) => job.name === 'search.reindex-dealer' && job.data.dealerId === 'dealer-1',
        ),
        `${type} should reindex`,
      ).toBe(true);
    }
  });

  it('reindexes and notifies on approval of a dealership', async () => {
    const h = setup();
    await h.register();

    await h.publish('DealerApproved', { aggregateId: 'dealer-1' });

    expect(h.sent.map((job) => job.name)).toEqual([
      'search.reindex-dealer',
      'notification.dealer-reviewed',
    ]);
  });

  it('both reindexes and notifies on suspension', async () => {
    const h = setup();
    await h.register();

    await h.publish('DealerSuspended', { aggregateId: 'dealer-1' });

    // Two separate subscribers on the same event; the dealer has to be told, and
    // their cars have to come down.
    expect(h.sent.map((job) => job.name)).toEqual([
      'search.reindex-dealer',
      'notification.dealer-reviewed',
    ]);
  });

  it('sends the invoice notification with the order id from the payload', async () => {
    const h = setup();
    await h.register();

    await h.publish('CreditsPurchased', {
      aggregateId: 'aggregate-1',
      payload: { orderId: 'order-9' },
    });

    expect(h.sent).toEqual([{ name: 'notification.invoice', data: { orderId: 'order-9' } }]);
  });

  it('falls back to the aggregate id when the purchase payload omits the order', async () => {
    const h = setup();
    await h.register();

    await h.publish('CreditsPurchased', { aggregateId: 'order-fallback', payload: {} });

    expect(h.sent).toEqual([{ name: 'notification.invoice', data: { orderId: 'order-fallback' } }]);
  });

  it('publishes rather than calling search directly', async () => {
    const h = setup();
    await h.register();

    await h.publish('ListingApproved', { aggregateId: 'listing-1' });

    // ARCHITECTURE §5.5 rule 5: `listings` never calls `search.index()`. The
    // handler enqueues, so a slow index can never roll back an approval.
    expect(h.indexed).toEqual([]);
  });
});

describe('registerSchedules', () => {
  it('schedules the nightly sweeps plus the hourly counter sweep', async () => {
    const schedules: { name: JobName; cron: string }[] = [];
    const queue = {
      schedule: (name: JobName, cron: string) => {
        schedules.push({ name, cron });
        return Promise.resolve();
      },
    } as unknown as Queue;

    await registerSchedules(queue);

    expect(schedules).toEqual([
      { name: 'listings.expire-sweep', cron: '15 2 * * *' },
      { name: 'counters.reconcile', cron: '30 3 * * *' },
      { name: 'media.gc-orphans', cron: '0 3 * * *' },
      // Hourly rather than nightly, and deliberately so: a busy day writes one
      // rate-limit row per request, and a full day of them makes the sweep
      // itself the largest delete the database sees.
      { name: 'cache.sweep-counters', cron: '5 * * * *' },
      // Daily, not hourly: this table gains a row per distinct plate looked
      // up — hundreds a day at most, nothing like the counter write rate.
      { name: 'rc.sweep-lookups', cron: '45 3 * * *' },
    ]);
  });

  it('staggers them, so three sweeps never contend for the same connections', async () => {
    const crons: string[] = [];
    const queue = {
      schedule: (_name: JobName, cron: string) => {
        crons.push(cron);
        return Promise.resolve();
      },
    } as unknown as Queue;

    await registerSchedules(queue);

    expect(new Set(crons).size).toBe(crons.length);
  });

  /**
   * Scoped to the nightly jobs on purpose. A cron whose hour field is `*` is
   * saying "every hour" — that is the cache sweep, which is cheap, bounded by
   * an index, and pointless to defer to 3am. The expensive sweeps are the ones
   * that must not land on top of each other or on daytime traffic.
   */
  it('runs the nightly sweeps in the small hours, IST', async () => {
    const crons: string[] = [];
    const queue = {
      schedule: (_name: JobName, cron: string) => {
        crons.push(cron);
        return Promise.resolve();
      },
    } as unknown as Queue;

    await registerSchedules(queue);

    const nightly = crons.filter((cron) => cron.split(' ')[1] !== '*');

    expect(nightly.length).toBeGreaterThanOrEqual(3);
    for (const cron of nightly) {
      const hour = Number(cron.split(' ')[1]);
      expect(hour).toBeGreaterThanOrEqual(1);
      expect(hour).toBeLessThanOrEqual(4);
    }
  });
});
