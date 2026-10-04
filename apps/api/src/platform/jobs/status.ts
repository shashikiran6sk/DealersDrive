import type { PrismaClient } from '@prisma/client';

export async function backgroundStatus(prisma: PrismaClient) {
  const [queues, outbox] = await Promise.all([
    prisma.$queryRaw<{ depth: number; age: number; failed: number }[]>`
      SELECT count(*) FILTER (WHERE state IN ('created','retry','active'))::int AS depth,
        COALESCE(EXTRACT(EPOCH FROM now() - min(created_on) FILTER (WHERE state IN ('created','retry'))),0)::float AS age,
        count(*) FILTER (WHERE state = 'failed' OR name = 'notification.email-dead-letter')::int AS failed
      FROM pgboss.job WHERE name IN ('notification.email','notification.email-dead-letter')`,
    prisma.$queryRaw<{ age: number; failed: number }[]>`
      SELECT COALESCE(EXTRACT(EPOCH FROM now() - min("createdAt") FILTER (WHERE "publishedAt" IS NULL)),0)::float AS age,
        (count(*) FILTER (WHERE "publishedAt" IS NULL AND attempts >= 10) +
          (SELECT count(*) FROM notification_deliveries WHERE status = 'FAILED'))::int AS failed FROM outbox_events`,
  ]);
  return {
    QueueDepth: queues[0]?.depth ?? 0,
    QueueAgeSeconds: queues[0]?.age ?? 0,
    FailedJobs: (queues[0]?.failed ?? 0) + (outbox[0]?.failed ?? 0),
    OutboxAgeSeconds: outbox[0]?.age ?? 0,
  };
}
