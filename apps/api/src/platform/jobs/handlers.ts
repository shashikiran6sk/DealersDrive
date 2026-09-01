import type { PrismaClient } from '@prisma/client';

import { formatDate } from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import type { DomainEvent, EventBus } from '../events/bus.js';
import type { MailerPort, SmsPort } from '../notify/notify.port.js';
import { logger } from '../telemetry/logger.js';
import type { Queue } from './queue.js';
import type { MediaService } from '../../modules/media/media.service.js';
import type { SearchRepository } from '../../modules/search/search.repository.js';

export interface HandlerDeps {
  prisma: PrismaClient;
  queue: Queue;
  bus: EventBus;
  search: SearchRepository;
  media: MediaService;
  mailer: MailerPort;
  sms: SmsPort;
}

/**
 * Subscribers and job handlers.
 *
 * `listings` never calls `search.index()` — it publishes `ListingApproved` and
 * search subscribes (ARCHITECTURE §5.5 rule 5). Every handler here is
 * idempotent and assumes it will run twice; payloads carry ids, never PII, and
 * each handler re-fetches what it needs.
 */
/**
 * Reads an id out of a job payload.
 *
 * The payload comes back from the queue as JSON, so it is `unknown` per key.
 * `String(data.listingId)` would happily turn an object into `[object Object]`
 * and pass it on as an id — a lookup that then fails somewhere far away. Anything
 * that is not a string reads as absent, which every handler already treats as
 * "nothing to do".
 */
function jobId(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

export async function registerHandlers(deps: HandlerDeps): Promise<void> {
  const { prisma, queue, bus, search, media, mailer, sms } = deps;

  await queue.work('media.process', async (data) => {
    const mediaId = jobId(data, 'mediaId');
    if (mediaId) await media.process(mediaId);
  });

  await queue.work('search.index-listing', async (data) => {
    const listingId = jobId(data, 'listingId');
    if (listingId) await search.index(listingId);
  });

  await queue.work('search.remove-listing', async (data) => {
    const listingId = jobId(data, 'listingId');
    if (listingId) await search.remove(listingId);
  });

  await queue.work('search.reindex-dealer', async (data) => {
    const dealerId = jobId(data, 'dealerId');
    if (!dealerId) return;
    const listingIds = await search.listListingIdsForDealer(dealerId);
    for (const listingId of listingIds) await search.index(listingId);
  });

  /**
   * The single most important message the system sends. Target p95 under 30
   * seconds; it carries the buyer's name, a tappable number and a direct link
   * (§14.5).
   */
  await queue.work('notification.enquiry-to-dealer', async (data) => {
    const enquiryId = jobId(data, 'enquiryId');
    if (!enquiryId) return;

    const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      include: {
        dealer: { include: { members: { include: { user: true }, where: { role: 'OWNER' } } } },
        vehicle: { include: { make: true, model: true, variant: true } },
      },
    });
    if (!enquiry || enquiry.status === 'SPAM') return;

    const owner = enquiry.dealer.members[0]?.user;
    const title = enquiry.vehicle
      ? [
          enquiry.vehicle.year,
          enquiry.vehicle.make.name,
          enquiry.vehicle.model.name,
          enquiry.vehicle.variant?.name,
        ]
          .filter(Boolean)
          .join(' ')
      : 'your dealership';

    const body = [
      `${enquiry.name} enquired about ${title}.`,
      `Phone: ${enquiry.phone}`,
      enquiry.message ? `Message: ${enquiry.message}` : null,
      `Reference: ${enquiry.reference}`,
      `Open the inbox: ${env.WEB_BASE_URL}/dealer/enquiries`,
    ]
      .filter(Boolean)
      .join('\n');

    if (owner?.email) {
      await mailer.send({
        to: owner.email,
        subject: `New enquiry — ${title} (${enquiry.reference})`,
        body,
      });
    }
    if (enquiry.dealer.contactPhone) {
      await sms.send({
        to: enquiry.dealer.contactPhone,
        body: `Dealers-Drive: new enquiry from ${enquiry.name} (${enquiry.phone}) on ${title}. Ref ${enquiry.reference}.`,
      });
    }

    // Counters are batched off the request path; the enquiry itself is not.
    if (enquiry.listingId) {
      await prisma.listing.update({
        where: { id: enquiry.listingId },
        data: { enquiryCount: { increment: 1 } },
      });
    }
  });

  await queue.work('notification.listing-reviewed', async (data) => {
    const listingId = jobId(data, 'listingId');
    if (!listingId) return;

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        dealer: { include: { members: { include: { user: true }, where: { role: 'OWNER' } } } },
        vehicle: { include: { make: true, model: true } },
      },
    });
    const owner = listing?.dealer.members[0]?.user;
    if (!listing || !owner?.email) return;

    const title = `${listing.vehicle.year} ${listing.vehicle.make.name} ${listing.vehicle.model.name}`;

    const body =
      listing.status === 'APPROVED'
        ? `${title} is now live in the catalogue until ${
            listing.expiresAt ? formatDate(listing.expiresAt) : 'further notice'
          }.`
        : listing.status === 'REJECTED'
          ? `${title} was not approved. Reason: ${listing.rejectionReason ?? '—'}\n\nEdit and resubmit: ${env.WEB_BASE_URL}/dealer/inventory`
          : `${title} needs changes. Note: ${listing.changeRequestNote ?? '—'}`;

    await mailer.send({ to: owner.email, subject: `Listing update — ${title}`, body });
  });

  await queue.work('notification.dealer-reviewed', async (data) => {
    const dealerId = jobId(data, 'dealerId');
    if (!dealerId) return;
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      include: { members: { include: { user: true }, where: { role: 'OWNER' } } },
    });
    const owner = dealer?.members[0]?.user;
    if (!dealer || !owner?.email) return;

    await mailer.send({
      to: owner.email,
      subject: `Your dealership is ${dealer.status.toLowerCase().replace('_', ' ')}`,
      body: dealer.statusReason
        ? `Status: ${dealer.status}. ${dealer.statusReason}`
        : `Status: ${dealer.status}.`,
    });
  });

  await queue.work('notification.invoice', async (data) => {
    const orderId = jobId(data, 'orderId');
    if (!orderId) return;
    const invoice = await prisma.invoice.findFirst({
      where: { orderId },
      include: { dealer: { include: { members: { include: { user: true }, where: { role: 'OWNER' } } } } },
    });
    const owner = invoice?.dealer.members[0]?.user;
    if (!invoice || !owner?.email) return;

    await mailer.send({
      to: owner.email,
      subject: `Invoice ${invoice.number}`,
      body: `${invoice.credits} credits added. Invoice ${invoice.number} is available in Billing & credits.`,
    });
  });

  /**
   * The nightly expiry sweep. On approval `expiresAt = approvedAt + N days`;
   * this moves anything past it to EXPIRED and drops it from the catalogue.
   */
  await queue.work('listings.expire-sweep', async () => {
    const due = await prisma.listing.findMany({
      where: { status: 'APPROVED', expiresAt: { lte: new Date() } },
      select: { id: true, dealerId: true },
    });

    for (const listing of due) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { status: 'EXPIRED' },
      });
      await search.remove(listing.id);
      await prisma.dealer.update({
        where: { id: listing.dealerId },
        data: { activeListings: await prisma.listing.count({ where: { dealerId: listing.dealerId, status: 'APPROVED' } }) },
      });
    }

    if (due.length > 0) logger.info({ count: due.length }, 'listings expired');
  });

  /**
   * The reconciliation job §26.8 asks for. These are not "log a warning"
   * conditions — each one is either money lost or a dealer's trust lost.
   */
  await queue.work('counters.reconcile', async () => {
    const dealers = await prisma.dealer.findMany({ select: { id: true, creditBalance: true, creditsHeld: true } });

    for (const dealer of dealers) {
      const newest = await prisma.creditTransaction.findFirst({
        where: { dealerId: dealer.id },
        orderBy: { seq: 'desc' },
        select: { balanceAfter: true },
      });
      const ledgerBalance = newest?.balanceAfter ?? 0;
      if (ledgerBalance !== dealer.creditBalance) {
        logger.error(
          { dealerId: dealer.id, ledgerBalance, cached: dealer.creditBalance },
          'LEDGER DRIFT — cached balance disagrees with the newest ledger row',
        );
      }

      const held = await prisma.listing.count({
        where: {
          dealerId: dealer.id,
          creditHeld: true,
          status: { in: ['PENDING_REVIEW', 'CHANGES_REQUESTED'] },
        },
      });
      if (held !== dealer.creditsHeld) {
        logger.error(
          { dealerId: dealer.id, held, cached: dealer.creditsHeld },
          'HELD-CREDIT DRIFT — cached held count disagrees with live listings',
        );
      }
    }

    const approvedWithoutConsume = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM listings l
      WHERE l.status = 'APPROVED'
        AND NOT EXISTS (
          SELECT 1 FROM credit_transactions t
          WHERE t."listingId" = l.id AND t.reason = 'CONSUME_APPROVE')`;
    const orphaned = Number(approvedWithoutConsume[0]?.count ?? 0n);
    if (orphaned > 0) {
      logger.error({ count: orphaned }, 'APPROVED listings with no CONSUME_APPROVE ledger row');
    }
  });

  // ─────────── subscribers ────────────────────────────────────────────────

  const index = async (event: DomainEvent) => {
    await queue.send('search.index-listing', { listingId: event.aggregateId });
  };
  const unindex = async (event: DomainEvent) => {
    await queue.send('search.remove-listing', { listingId: event.aggregateId });
  };

  bus.on('ListingApproved', index);
  bus.on('ListingApproved', async (event) => {
    await queue.send('notification.listing-reviewed', { listingId: event.aggregateId });
  });
  bus.on('ListingRejected', unindex);
  bus.on('ListingRejected', async (event) => {
    await queue.send('notification.listing-reviewed', { listingId: event.aggregateId });
  });
  bus.on('ListingChangesRequested', async (event) => {
    await queue.send('notification.listing-reviewed', { listingId: event.aggregateId });
  });
  bus.on('ListingRemoved', unindex);
  bus.on('ListingExpired', unindex);
  // A sale re-indexes rather than un-indexes: the row stays in `listing_search`
  // and `is_sold` flips, which is what keeps the car on the marketplace as
  // badged, unclickable proof that this dealer moves stock. `ListingRemoved`
  // above is the event that actually deletes the row.
  bus.on('VehicleSold', index);
  bus.on('ListingSubmitted', unindex);

  bus.on('EnquiryCreated', async (event) => {
    await queue.send('notification.enquiry-to-dealer', {
      enquiryId: (event.payload as { enquiryId?: string }).enquiryId ?? event.aggregateId,
    });
  });
  bus.on('PhoneRevealed', async (event) => {
    await queue.send('notification.enquiry-to-dealer', {
      enquiryId: (event.payload as { enquiryId?: string }).enquiryId ?? event.aggregateId,
    });
  });

  // Suspending a dealer pulls all their listings out of the catalogue at once.
  bus.on('DealerSuspended', async (event) => {
    await queue.send('search.reindex-dealer', { dealerId: event.aggregateId });
  });
  bus.on('DealerRejected', async (event) => {
    await queue.send('search.reindex-dealer', { dealerId: event.aggregateId });
  });
  bus.on('DealerReinstated', async (event) => {
    await queue.send('search.reindex-dealer', { dealerId: event.aggregateId });
  });
  bus.on('DealerApproved', async (event) => {
    await queue.send('search.reindex-dealer', { dealerId: event.aggregateId });
    await queue.send('notification.dealer-reviewed', { dealerId: event.aggregateId });
  });
  bus.on('DealerSuspended', async (event) => {
    await queue.send('notification.dealer-reviewed', { dealerId: event.aggregateId });
  });

  bus.on('CreditsPurchased', async (event) => {
    await queue.send('notification.invoice', {
      orderId: (event.payload as { orderId?: string }).orderId ?? event.aggregateId,
    });
  });
}

/** Cron entries. IST, because the dealers are in Tamil Nadu. */
export async function registerSchedules(queue: Queue): Promise<void> {
  await queue.schedule('listings.expire-sweep', '15 2 * * *');
  await queue.schedule('counters.reconcile', '30 3 * * *');
  await queue.schedule('media.gc-orphans', '0 3 * * *');
}
