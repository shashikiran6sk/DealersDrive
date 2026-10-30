import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import {
  createNotificationsService,
  enquiryDigestJob,
  previousIstDay,
} from '../src/modules/notifications/notifications.service.js';
import { createInlineQueue } from '../src/platform/jobs/queue.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * The daily enquiry summary to admins: one email per admin per IST day,
 * listing that day's enquiries by dealership. Days far in the future keep the
 * suite's other enquiries out of the window.
 */
let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let buyer: Dealership;
const OPS = env.adminAllowlist[0] ?? '';

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'enquiry-digest');
  buyer = await fixtures.dealership();
});
afterAll(async () => {
  await h.close();
});

function service() {
  return createNotificationsService({
    prisma: h.prisma,
    queue: createInlineQueue(),
    mailer: h.mailer,
  });
}

async function car(dealer: Dealership, make: string, model: string) {
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: dealer.dealerId,
      registrationNumber: `DIGEST${randomUUID()}`,
      make,
      model,
      manufacturingYear: 2021,
    },
  });
  return h.prisma.listing.create({
    data: {
      dealerId: dealer.dealerId,
      vehicleId: vehicle.id,
      status: 'ACTIVE',
      slug: `enquiry-digest-${randomUUID()}`,
      publishedAt: new Date(),
    },
  });
}

async function enquiry(listing: { id: string; dealerId: string }, createdAt: string) {
  await h.prisma.enquiry.create({
    data: {
      customerId: buyer.userId,
      dealerId: listing.dealerId,
      listingId: listing.id,
      createdAt: new Date(createdAt),
    },
  });
}

function digests(before: number) {
  return h.mailer.sent.slice(before).filter((message) => message.tag === 'admin.enquiry.digest');
}

describe('the daily enquiry summary', () => {
  it('lists one IST day’s enquiries by dealership, busiest first, to every admin', async () => {
    const busy = await fixtures.dealership();
    const quiet = await fixtures.dealership();
    const creta = await car(busy, 'Hyundai', 'Creta');
    const swift = await car(quiet, 'Maruti Suzuki', 'Swift');
    await enquiry(creta, '2031-01-15T00:00:00.000+05:30');
    await enquiry(creta, '2031-01-15T23:59:00.000+05:30');
    await enquiry(swift, '2031-01-15T12:00:00.000+05:30');
    await enquiry(swift, '2031-01-14T23:59:00.000+05:30');
    await enquiry(swift, '2031-01-16T00:00:00.000+05:30');
    const names = await h.prisma.dealer.findMany({
      where: { id: { in: [busy.dealerId, quiet.dealerId] } },
      select: { id: true, brandName: true },
    });
    const name = (id: string) => names.find((dealer) => dealer.id === id)?.brandName ?? '';

    const before = h.mailer.sent.length;
    await service().sendEnquiryDigest('2031-01-15');

    const sent = digests(before);
    expect(sent.map((message) => message.to)).toContain(OPS);
    const message = sent.find((mail) => mail.to === OPS);
    expect(message?.subject).toBe('3 enquiries on 15 Jan 2031 — Dealers-Drive');
    const text = message?.text ?? '';
    expect(text).toContain(`${name(busy.dealerId)} — 2: 2021 Hyundai Creta`);
    expect(text).toContain(`${name(quiet.dealerId)} — 1: 2021 Maruti Suzuki Swift`);
    expect(text.indexOf(name(busy.dealerId))).toBeLessThan(text.indexOf(name(quiet.dealerId)));
  });

  it('sends each admin one summary a day however often the job runs', async () => {
    const dealer = await fixtures.dealership();
    await enquiry(await car(dealer, 'Honda', 'City'), '2031-02-10T10:00:00.000+05:30');

    const before = h.mailer.sent.length;
    await service().sendEnquiryDigest('2031-02-10');
    const first = digests(before).length;
    await service().handleEmailJob(enquiryDigestJob('2031-02-10'));
    await service().sendEnquiryDigest('2031-02-10');

    expect(first).toBeGreaterThan(0);
    expect(digests(before)).toHaveLength(first);
  });

  it('sends nothing on a day without enquiries', async () => {
    const before = h.mailer.sent.length;
    await service().sendEnquiryDigest('2031-03-01');
    expect(digests(before)).toHaveLength(0);
  });

  it('runs the scheduled job for the day before in India', async () => {
    const yesterday = previousIstDay(new Date());
    const dealer = await fixtures.dealership();
    await enquiry(await car(dealer, 'Tata', 'Nexon'), `${yesterday}T12:00:00.000+05:30`);
    const queue = createInlineQueue();
    const notifications = createNotificationsService({
      prisma: h.prisma,
      queue,
      mailer: h.mailer,
    });
    await notifications.work();

    const before = h.mailer.sent.length;
    await queue.send('notifications.enquiry-digest', {});

    const sent = digests(before).filter((message) => message.to === OPS);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain('2021 Tata Nexon');
  });
});
