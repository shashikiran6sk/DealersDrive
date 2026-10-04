import { afterAll, describe, expect, it, vi } from 'vitest';

// Exercise the actual PostgreSQL queue and production retry/provider boundary.
// No email leaves this test: HTTP is a controlled 503 then success response.
vi.stubEnv('JOBS_ENABLED', 'true');
vi.resetModules();
const { createQueue } = await import('../src/platform/jobs/queue.js');
const { createPrisma } = await import('../src/platform/db/prisma.js');
const { createNotificationsService } =
  await import('../src/modules/notifications/notifications.service.js');
const { createEventBus } = await import('../src/platform/events/bus.js');
const { createResendMailer } = await import('../src/platform/mail/resend.adapter.js');
const prisma = createPrisma();
const queue = createQueue();

afterAll(async () => {
  await queue.stop();
  await prisma.$disconnect();
  vi.unstubAllEnvs();
});

async function until(check: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Queue did not reach the expected state within ten seconds');
}

describe('production queue delivery', () => {
  it('enqueues a business event, retries one controlled provider failure, and skips duplicate delivery', async () => {
    const owner = await prisma.dealerMember.findFirstOrThrow({
      where: { role: 'OWNER', status: 'ACTIVE', user: { email: { not: null } } },
    });
    const subjectId = crypto.randomUUID();
    const requests: RequestInit[] = [];
    const fetchImpl: typeof fetch = (_url, init) => {
      requests.push(init ?? {});
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'controlled-provider-id' }), {
          status: requests.length === 1 ? 503 : 200,
        }),
      );
    };
    const notifications = createNotificationsService({
      prisma,
      queue,
      mailer: createResendMailer(fetchImpl),
    });
    const bus = createEventBus();
    notifications.subscribe(bus);
    await notifications.work();
    await queue.start();
    await bus.publish({
      id: subjectId,
      type: 'DealerApproved',
      version: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'Dealer',
      aggregateId: owner.dealerId,
      dealerId: owner.dealerId,
      actor: { type: 'SYSTEM' },
      traceId: subjectId,
      payload: {},
    });
    await until(
      async () =>
        requests.length === 1 &&
        (
          await prisma.$queryRaw<
            { count: number }[]
          >`SELECT count(*)::int AS count FROM pgboss.job WHERE name='notification.email' AND state='retry'`
        )[0]?.count === 1,
    );
    // Don't wait the configured 30sec in CI; prove retry persisted, then advance
    // only this controlled event's retry eligibility in the dedicated test DB.
    await prisma.$executeRaw`UPDATE pgboss.job SET start_after=now() WHERE name='notification.email' AND state='retry' AND data->>'subjectId'=${subjectId}`;
    await until(
      async () =>
        (await prisma.notificationDelivery.findFirst({
          where: { dedupeKey: { contains: subjectId }, status: 'SENT' },
        })) !== null,
    );
    expect(requests).toHaveLength(2);
    expect(requests[0]?.headers).toEqual(requests[1]?.headers);
    await queue.send('notification.email', {
      template: 'dealer.application.approved',
      dealerId: owner.dealerId,
      audience: 'dealer',
      subjectId,
    });
    await until(
      async () =>
        (
          await prisma.$queryRaw<
            { count: number }[]
          >`SELECT count(*)::int AS count FROM pgboss.job WHERE name='notification.email' AND state='completed' AND data->>'subjectId'=${subjectId}`
        )[0]?.count === 2,
    );
    expect(requests).toHaveLength(2);
  }, 30_000);
});
