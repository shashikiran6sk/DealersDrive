import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createEventBus, type DomainEvent } from '../../../../src/platform/events/bus.js';
import { createInlineQueue } from '../../../../src/platform/jobs/queue.js';
import type { MailMessage, MailerPort } from '../../../../src/platform/mail/mail.port.js';
import { PermanentMailError } from '../../../../src/platform/mail/resend.adapter.js';
import {
  createNotificationsService,
  type EmailJob,
} from '../../../../src/modules/notifications/notifications.service.js';

/**
 * Who gets told what, and exactly once (**R40**).
 *
 * The three properties worth a test here are the three that fail silently in
 * production:
 *
 *   1. **Six product rules.** A rejection emails the dealer; an application
 *      emails the dealer *and* us. Getting one wrong is a person who is never
 *      told something.
 *   2. **Idempotency.** pg-boss guarantees at-least-once, so a duplicate
 *      delivery is not a bug to prevent — it is a normal event to absorb. The
 *      unique `dedupeKey` is what absorbs it, and it is claimed *before* the
 *      provider is called.
 *   3. **Retryable versus permanent.** A 5xx must be thrown so the queue backs
 *      off; a 4xx must not, because five more attempts produce the same 422 and
 *      the row that says why already exists.
 *
 * `prisma` is a hand-written fake rather than a mocked client: what is being
 * tested is a sequence of calls with a unique-index race in the middle, and a
 * fake that *has* the index is a far better model of that than a stub that
 * returns whatever it is told to.
 */
interface Row {
  id: string;
  dedupeKey: string;
  template: string;
  recipient: string;
  subject: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  providerMessageId: string | null;
  lastError: string | null;
  dealerId: string | null;
  sentAt: Date | null;
}

/** A unique index, in fifteen lines. It is the whole idempotency guarantee. */
function fakePrisma(
  options: {
    owner?: { email: string | null; fullName: string | null } | null;
    dealer?: Record<string, unknown> | null;
    rejectedSnapshot?: Record<string, unknown> | null;
  } = {},
) {
  const rows = new Map<string, Row>();
  const owner =
    options.owner === undefined
      ? { email: 'owner@srilakshmimotors.in', fullName: 'Karthik Raman' }
      : options.owner;

  const prisma = {
    notificationDelivery: {
      create: ({ data }: { data: Partial<Row> }) => {
        const key = data.dedupeKey ?? '';
        if (rows.has(key)) {
          // Prisma's own shape for a unique violation, which is what the
          // service duck-types on.
          return Promise.reject(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));
        }
        const row: Row = {
          id: `delivery-${String(rows.size + 1)}`,
          dedupeKey: key,
          template: data.template ?? '',
          recipient: data.recipient ?? '',
          subject: data.subject ?? '',
          status: 'PENDING',
          attempts: data.attempts ?? 1,
          providerMessageId: null,
          lastError: null,
          dealerId: data.dealerId ?? null,
          sentAt: null,
        };
        rows.set(key, row);
        return Promise.resolve(row);
      },
      findUnique: ({ where }: { where: { dedupeKey: string } }) =>
        Promise.resolve(rows.get(where.dedupeKey) ?? null),
      update: ({
        where,
        data,
      }: {
        where: { dedupeKey: string };
        data: Record<string, unknown>;
      }) => {
        const row = rows.get(where.dedupeKey);
        if (!row) return Promise.reject(new Error('no such row'));
        for (const [key, value] of Object.entries(data)) {
          if (key === 'attempts' && typeof value === 'object' && value !== null) {
            row.attempts += (value as { increment: number }).increment;
          } else {
            (row as unknown as Record<string, unknown>)[key] = value;
          }
        }
        return Promise.resolve(row);
      },
    },
    dealer: {
      findUnique: () =>
        Promise.resolve(
          options.dealer === null
            ? null
            : {
                brandName: 'Sri Lakshmi Motors',
                legalName: 'Sri Lakshmi Motors Pvt Ltd',
                slug: 'sri-lakshmi-motors',
                tagline: 'Family-run since 1998.',
                specialities: ['In-house workshop'],
                ...options.dealer,
              },
        ),
    },
    dealerMember: {
      findFirst: () => Promise.resolve(owner === null ? null : { user: owner }),
    },
    auditLog: {
      findFirst: () =>
        Promise.resolve(
          options.rejectedSnapshot === undefined || options.rejectedSnapshot === null
            ? null
            : { before: options.rejectedSnapshot },
        ),
    },
  } as unknown as PrismaClient;

  return { prisma, rows };
}

function recordingMailer(
  behaviour: (message: MailMessage) => Promise<{ id: string | null }> = () =>
    Promise.resolve({ id: 'resend-1' }),
): MailerPort & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    driver: 'console',
    sent,
    async send(message) {
      sent.push(message);
      const result = await behaviour(message);
      return { providerMessageId: result.id };
    },
  };
}

function setup(options: Parameters<typeof fakePrisma>[0] = {}, mailer = recordingMailer()) {
  const { prisma, rows } = fakePrisma(options);
  const queue = createInlineQueue();
  const service = createNotificationsService({ prisma, queue, mailer });
  return { service, prisma, rows, queue, mailer };
}

function event(type: DomainEvent['type'], payload: Record<string, unknown> = {}): DomainEvent {
  return {
    id: 'evt-1',
    type,
    version: 1,
    occurredAt: new Date().toISOString(),
    aggregateType: 'Dealer',
    aggregateId: 'dealer-1',
    dealerId: 'dealer-1',
    actor: { type: 'ADMIN', id: 'admin-1' },
    traceId: 'trace-1',
    payload,
  };
}

const JOB: EmailJob = {
  template: 'dealer.application.approved',
  dealerId: 'dealer-1',
  audience: 'dealer',
  subjectId: 'evt-1',
};

describe('the notification rules', () => {
  /** Every case asserts the *template*, because that is the product decision. */
  async function templatesFor(
    type: DomainEvent['type'],
    payload: Record<string, unknown> = {},
  ): Promise<string[]> {
    const { service, mailer } = setup();
    const bus = createEventBus();
    service.subscribe(bus);
    await service.work();
    await bus.publish(event(type, payload));
    return mailer.sent.map((message) => message.tag);
  }

  it('emails the dealer and the admins when an application arrives', async () => {
    await expect(templatesFor('DealerApplied')).resolves.toEqual([
      'dealer.application.received',
      'admin.application.received',
    ]);
  });

  it('uses distinct dealer and admin emails when an application is resubmitted', async () => {
    await expect(templatesFor('DealerApplied', { resubmitted: true })).resolves.toEqual([
      'dealer.application.resubmitted',
      'admin.application.resubmitted',
    ]);
  });

  it('emails the dealer on approval', async () => {
    await expect(templatesFor('DealerApproved')).resolves.toEqual(['dealer.application.approved']);
  });

  /**
   * Two events, two templates. They mean opposite things to a dealer — one is
   * the end of the application, the other is a task — and a shared message
   * would have to be vague about which.
   */
  it('emails the dealer on a rejection, with the reason', async () => {
    const { service, mailer } = setup();
    const bus = createEventBus();
    service.subscribe(bus);
    await service.work();

    await bus.publish(
      event('DealerRejected', { reason: 'The GST certificate is for another entity.' }),
    );

    expect(mailer.sent[0]?.tag).toBe('dealer.application.rejected');
    expect(mailer.sent[0]?.text).toContain('The GST certificate is for another entity.');
  });

  it('sends a rejection from the surviving audit snapshot after the dealer is purged', async () => {
    const { service, mailer, rows } = setup({
      owner: null,
      dealer: null,
      // `contactEmail` is the historical snapshot field, proving queued
      // events from before the fix can also be recovered.
      rejectedSnapshot: {
        brandName: 'Sri Lakshmi Motors',
        legalName: 'Sri Lakshmi Motors Pvt Ltd',
        contactEmail: 'applicant@example.com',
        recipientName: 'Karthik Raman',
      },
    });

    await service.handleEmailJob({
      ...JOB,
      template: 'dealer.application.rejected',
      reason: 'The GST certificate is for another entity.',
    });

    expect(mailer.sent[0]).toMatchObject({
      to: 'applicant@example.com',
      tag: 'dealer.application.rejected',
    });
    expect(mailer.sent[0]?.text).toContain('Sri Lakshmi Motors');
    expect(mailer.sent[0]?.text).toContain('The GST certificate is for another entity.');
    expect([...rows.values()][0]?.dealerId).toBeNull();
  });

  it('emails the dealer when changes are requested', async () => {
    await expect(
      templatesFor('DealerChangesRequested', { reason: 'Upload a clearer PAN card.' }),
    ).resolves.toEqual(['dealer.application.changes-requested']);
  });

  it('emails the admins when a profile change is submitted', async () => {
    await expect(templatesFor('DealerProfileChangeSubmitted')).resolves.toEqual([
      'admin.profile-change.submitted',
    ]);
  });

  it('emails the dealer when the dealership is suspended', async () => {
    const { service, mailer } = setup();
    const bus = createEventBus();
    service.subscribe(bus);
    await service.work();

    await bus.publish(event('DealerSuspended', { reason: 'GST registration has expired.' }));

    expect(mailer.sent[0]?.tag).toBe('dealer.account.suspended');
    expect(mailer.sent[0]?.text).toContain('GST registration has expired.');
  });

  it('emails the dealer when the dealership is reinstated', async () => {
    await expect(templatesFor('DealerReinstated')).resolves.toEqual(['dealer.account.reinstated']);
  });

  /** One event, two verdicts. `payload.published` is which way (R34). */
  it('emails the dealer on an approved profile change', async () => {
    await expect(templatesFor('DealerProfileChangeDecided', { published: true })).resolves.toEqual([
      'dealer.profile-change.approved',
    ]);
  });

  it('emails the dealer on a refused profile change, with the reason', async () => {
    const { service, mailer } = setup();
    const bus = createEventBus();
    service.subscribe(bus);
    await service.work();

    await bus.publish(
      event('DealerProfileChangeDecided', {
        published: false,
        reason: 'It carries a phone number.',
      }),
    );

    expect(mailer.sent[0]?.tag).toBe('dealer.profile-change.rejected');
    expect(mailer.sent[0]?.text).toContain('It carries a phone number.');
  });
});

describe('idempotency', () => {
  /**
   * **The property the whole table exists for.** pg-boss guarantees
   * at-least-once, so a duplicate delivery is not a bug to prevent — it is a
   * normal event to absorb.
   */
  it('sends one email however many times the job is delivered', async () => {
    const { service, mailer, rows } = setup();

    await service.handleEmailJob(JOB);
    await service.handleEmailJob(JOB);
    await service.handleEmailJob(JOB);

    expect(mailer.sent).toHaveLength(1);
    expect([...rows.values()]).toHaveLength(1);
    expect([...rows.values()][0]?.status).toBe('SENT');
  });

  /** The key is derived from the event, so two *different* events both send. */
  it('sends again for a different event', async () => {
    const { service, mailer } = setup();

    await service.handleEmailJob(JOB);
    await service.handleEmailJob({ ...JOB, subjectId: 'evt-2' });

    expect(mailer.sent).toHaveLength(2);
  });

  /** And a different recipient of the same event is a different email. */
  it('keys on the recipient as well as the event', async () => {
    const { service, rows } = setup();

    await service.handleEmailJob(JOB);

    expect([...rows.keys()][0]).toBe('dealer.application.approved:evt-1:owner@srilakshmimotors.in');
  });

  /** The claim happens *before* the provider is called — asserted from the row. */
  it('claims the row before sending', async () => {
    const claimedWhenSent: (string | undefined)[] = [];
    const { rows, service } = setup(
      {},
      recordingMailer(() => {
        claimedWhenSent.push([...rows.values()][0]?.status);
        return Promise.resolve({ id: 'resend-1' });
      }),
    );

    await service.handleEmailJob(JOB);

    expect(claimedWhenSent).toEqual(['PENDING']);
  });

  /**
   * A retry of a *failed* attempt must still go out. The unique key is not a
   * "never send this again" flag — it is "never send this **twice**".
   */
  it('lets a failed attempt be retried, and counts the attempts', async () => {
    let attempt = 0;
    const { service, mailer, rows } = setup(
      {},
      recordingMailer(() => {
        attempt += 1;
        if (attempt === 1) return Promise.reject(new Error('ECONNRESET'));
        return Promise.resolve({ id: 'resend-2' });
      }),
    );

    await expect(service.handleEmailJob(JOB)).rejects.toThrow(/ECONNRESET/);
    await service.handleEmailJob(JOB);

    expect(mailer.sent).toHaveLength(2);
    const row = [...rows.values()][0];
    expect(row?.status).toBe('SENT');
    expect(row?.attempts).toBe(2);
    expect(row?.lastError).toBeNull();
  });
});

describe('failure', () => {
  /** Rethrown, so pg-boss backs off and tries again. */
  it('rethrows a retryable failure and leaves the row PENDING', async () => {
    const { service, rows } = setup(
      {},
      recordingMailer(() => Promise.reject(new Error('Resend answered 503'))),
    );

    await expect(service.handleEmailJob(JOB)).rejects.toThrow(/503/);

    const row = [...rows.values()][0];
    expect(row?.status).toBe('PENDING');
    expect(row?.lastError).toContain('503');
  });

  /**
   * Swallowed **deliberately**. Rethrowing would make the queue spend twenty
   * minutes collecting the same 422 from Resend, and then archive a job nobody
   * opens — while the row that says what went wrong already exists.
   */
  it('does not rethrow a permanent failure, and marks the row FAILED', async () => {
    const { service, rows } = setup(
      {},
      recordingMailer(() =>
        Promise.reject(new PermanentMailError('Resend refused it (403): domain not verified')),
      ),
    );

    await expect(service.handleEmailJob(JOB)).resolves.toBeUndefined();

    const row = [...rows.values()][0];
    expect(row?.status).toBe('FAILED');
    expect(row?.lastError).toContain('domain not verified');
  });

  /** A dealership with no owner address is not an error to retry forever. */
  it('skips a dealer with no email, without a delivery row', async () => {
    const { service, mailer, rows } = setup({ owner: { email: null, fullName: null } });

    await expect(service.handleEmailJob(JOB)).resolves.toBeUndefined();

    expect(mailer.sent).toHaveLength(0);
    expect([...rows.values()]).toHaveLength(0);
  });
});

describe('recipients', () => {
  /**
   * The admin audience is `ADMIN_ALLOWLIST` — the same list that decides who
   * may hold an admin session. A queue email to somebody who cannot open the
   * queue would be a leak with no purpose.
   */
  it('fans an admin message out to the allow-list', async () => {
    const { service, mailer } = setup();

    await service.handleEmailJob({
      ...JOB,
      template: 'admin.application.received',
      audience: 'admin',
    });

    expect(mailer.sent.length).toBeGreaterThan(0);
    for (const message of mailer.sent) expect(message.to).toContain('@');
  });

  /** The address is resolved at send time, never carried on the job. */
  it('reads the dealer address out of the database', async () => {
    const { service, mailer } = setup();

    await service.handleEmailJob(JOB);

    expect(mailer.sent[0]?.to).toBe('owner@srilakshmimotors.in');
    expect(mailer.sent[0]?.text).toContain('Karthik Raman');
  });
});
