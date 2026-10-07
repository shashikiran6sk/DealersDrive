import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createEventBus, type DomainEvent } from '../../../../src/platform/events/bus.js';
import { createInlineQueue } from '../../../../src/platform/jobs/queue.js';
import type { MailMessage, MailerPort } from '../../../../src/platform/mail/mail.port.js';
import { PermanentMailError } from '../../../../src/platform/mail/resend.adapter.js';
import type { ClaimLink } from '../../../../src/modules/dealer-claims/dealer-claims.facade.js';
import { NOTIFICATION_RULES } from '../../../../src/modules/notifications/notification.rules.js';
import {
  MAX_DELIVERY_ATTEMPTS,
  createNotificationsService,
  jobOf,
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
    dealerQueries?: unknown[];
    members?: {
      status: string;
      source: string;
      role: string;
      user: { email: string | null; fullName: string | null; status: string };
    }[];
    user?: {
      email: string | null;
      emailVerifiedAt: Date | null;
      fullName: string | null;
      status: string;
    } | null;
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
      findUnique: ({ where }: { where: { dedupeKey: string } }) => {
        const row = rows.get(where.dedupeKey);
        return Promise.resolve(row ? { ...row } : null);
      },
      findFirst: ({
        where,
      }: {
        where: { template: string; status: string; dedupeKey: { startsWith: string } };
      }) =>
        Promise.resolve(
          [...rows.values()].find(
            (row) =>
              row.template === where.template &&
              row.status === where.status &&
              row.dedupeKey.startsWith(where.dedupeKey.startsWith),
          ) ?? null,
        ),
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
      findFirst: (args: unknown) => {
        options.dealerQueries?.push(args);
        return Promise.resolve(null);
      },
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
    adminMember: {
      findMany: ({ where }: { where: { role: { in: string[] } } }) =>
        Promise.resolve(
          (options.members ?? []).filter((member) => where.role.in.includes(member.role)),
        ),
    },
    user: {
      findUnique: () => Promise.resolve(options.user ?? null),
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

function setup(
  options: Parameters<typeof fakePrisma>[0] = {},
  mailer = recordingMailer(),
  claimLinks?: { issueLink: (id: string) => Promise<ClaimLink | null> },
) {
  const { prisma, rows } = fakePrisma(options);
  const queue = createInlineQueue();
  const service = createNotificationsService({
    prisma,
    queue,
    mailer,
    ...(claimLinks ? { claimLinks } : {}),
  });
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
    // Distinct templates, because the admin audience is the allow-list and the
    // list has more than one address on it: one template, fanned out, is one
    // rule. Which addresses it reaches is the `recipients` block's question.
    return [...new Set(mailer.sent.map((message) => message.tag))];
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

  /** ORIG-GAP-CLOSE. Its own message: a closed application was not rejected. */
  it('emails the dealer a dedicated message when the application is closed', async () => {
    const { service, mailer } = setup();
    const bus = createEventBus();
    service.subscribe(bus);
    await service.work();

    await bus.publish(event('DealerApplicationClosed', { reason: 'Duplicate application.' }));

    expect(mailer.sent.map((message) => message.tag)).toEqual(['dealer.application.closed']);
    expect(mailer.sent[0]?.text).toContain('Duplicate application.');
    expect(mailer.sent[0]?.subject).not.toMatch(/reject/i);
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

describe('the claim link (R113)', () => {
  function links(result: ClaimLink | null = LINK) {
    const issued: string[] = [];
    return {
      issued,
      issueLink: (id: string) => {
        issued.push(id);
        return Promise.resolve(result);
      },
    };
  }

  const LINK: ClaimLink = {
    email: 'selvi@gmail.com',
    name: 'Selvi R',
    dealerName: 'Claimable Motors',
    url: 'https://dealers-drive.test/claim/abc123',
    expiresAt: new Date('2026-10-09T10:00:00.000Z'),
  };

  async function request(claimLinks: ReturnType<typeof links>, mailer = recordingMailer()) {
    const { service } = setup({}, mailer, claimLinks);
    const bus = createEventBus();
    service.subscribe(bus);
    await service.work();
    await bus.publish({
      ...event('DealerEmailVerificationRequested', { verificationId: 'ver-1' }),
      aggregateType: 'DealerEmailVerification',
      aggregateId: 'ver-1',
    });
    return { service, mailer };
  }

  it('mints the link at send time and emails it to the verification’s address', async () => {
    const claimLinks = links();
    const { mailer } = await request(claimLinks);

    expect(claimLinks.issued).toEqual(['ver-1']);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({ to: 'selvi@gmail.com', tag: 'dealer.email.verify' });
    expect(mailer.sent[0]?.text).toContain(LINK.url);
    expect(mailer.sent[0]?.subject).toContain('Claimable Motors');
  });

  it('does not mint a second link once the email has been sent', async () => {
    const claimLinks = links();
    const { service, mailer } = await request(claimLinks);
    await service.handleEmailJob({
      template: 'dealer.email.verify',
      audience: 'dealer',
      dealerId: 'dealer-1',
      subjectId: 'ver-1',
    });

    expect(claimLinks.issued).toEqual(['ver-1']);
    expect(mailer.sent).toHaveLength(1);
  });

  it('sends nothing for a superseded or claimed verification', async () => {
    const { mailer } = await request(links(null));
    expect(mailer.sent).toHaveLength(0);
  });

  it('sends an unclaimed dealership’s mail only to a verified address', async () => {
    const dealerQueries: unknown[] = [];
    const { service, mailer } = setup({ owner: null, dealerQueries });

    await service.handleEmailJob(JOB);

    expect(mailer.sent).toHaveLength(0);
    expect(JSON.stringify(dealerQueries)).toContain('"contactEmailVerifiedAt":{"not":null}');
  });
});

describe('admin recipients (R115)', () => {
  const ADMIN_JOB: EmailJob = {
    ...JOB,
    template: 'admin.application.received',
    audience: 'admin',
    permission: 'admin:dealer:approve',
  };

  function member(email: string, role: string, extra: Record<string, string> = {}) {
    return {
      status: 'ACTIVE',
      source: 'INVITED',
      role,
      user: { email, fullName: null, status: 'ACTIVE' },
      ...extra,
    };
  }

  it('writes to the active members whose role holds the permission, once each', async () => {
    const { service, mailer } = setup({
      members: [
        member('priya@dealers-drive.in', 'MODERATOR'),
        member('PRIYA@dealers-drive.in', 'SUPER_ADMIN'),
        member('desk@dealers-drive.in', 'SUPPORT'),
        member('arun@dealers-drive.in', 'SALES_REP'),
      ],
    });
    await service.handleEmailJob(ADMIN_JOB);
    expect(mailer.sent.map((message) => message.to)).toEqual(['priya@dealers-drive.in']);
  });

  it('never writes to a bootstrap member the allow-list no longer admits', async () => {
    const { service, mailer } = setup({
      members: [
        member('former@dealers-drive.in', 'SUPER_ADMIN', { source: 'BOOTSTRAP' }),
        member('priya@dealers-drive.in', 'MODERATOR'),
      ],
    });
    await service.handleEmailJob(ADMIN_JOB);
    expect(mailer.sent.map((message) => message.to)).toEqual(['priya@dealers-drive.in']);
  });

  it('falls back to the allow-list when no member holds the permission', async () => {
    const { service, mailer } = setup({ members: [] });
    await service.handleEmailJob(ADMIN_JOB);
    expect(mailer.sent.length).toBeGreaterThan(0);
  });
});

describe('user recipients (R115)', () => {
  const USER_JOB: EmailJob = { ...JOB, audience: 'user', userId: 'user-9' };

  it('writes only to a verified address on an active account', async () => {
    const verified = setup({
      user: {
        email: 'buyer@gmail.com',
        emailVerifiedAt: new Date(),
        fullName: 'Asha',
        status: 'ACTIVE',
      },
    });
    await verified.service.handleEmailJob(USER_JOB);
    expect(verified.mailer.sent[0]?.to).toBe('buyer@gmail.com');

    for (const user of [
      { email: 'buyer@gmail.com', emailVerifiedAt: null, fullName: null, status: 'ACTIVE' },
      { email: null, emailVerifiedAt: null, fullName: null, status: 'ACTIVE' },
      {
        email: 'buyer@gmail.com',
        emailVerifiedAt: new Date(),
        fullName: null,
        status: 'SUSPENDED',
      },
    ]) {
      const refused = setup({ user });
      await refused.service.handleEmailJob(USER_JOB);
      expect(refused.mailer.sent).toHaveLength(0);
    }
  });
});

describe('a transient failure that never clears (R115)', () => {
  it('is marked FAILED on the last attempt, and stops being retried', async () => {
    const { service, rows } = setup(
      {},
      recordingMailer(() => Promise.reject(new Error('Resend answered 503'))),
    );
    for (let attempt = 1; attempt < MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      await expect(service.handleEmailJob(JOB)).rejects.toThrow(/503/);
    }
    await expect(service.handleEmailJob(JOB)).resolves.toBeUndefined();

    const row = [...rows.values()][0];
    expect(row).toMatchObject({ status: 'FAILED', attempts: MAX_DELIVERY_ATTEMPTS });
  });
});

describe('the rules table (R115)', () => {
  it('turns each rule into the job the old hand-written subscriber produced', () => {
    const applied = event('DealerApplied', { resubmitted: true });
    const [dealerRule, adminRule] = NOTIFICATION_RULES.DealerApplied ?? [];
    expect(dealerRule && jobOf(applied, dealerRule)).toEqual({
      template: 'dealer.application.resubmitted',
      audience: 'dealer',
      dealerId: 'dealer-1',
      subjectId: 'evt-1',
    });
    expect(adminRule && jobOf(applied, adminRule)).toMatchObject({
      template: 'admin.application.resubmitted',
      audience: 'admin',
      permission: 'admin:dealer:approve',
    });

    const [decided] = NOTIFICATION_RULES.DealerProfileChangeDecided ?? [];
    expect(
      decided && jobOf(event('DealerProfileChangeDecided', { published: true }), decided),
    ).toMatchObject({ template: 'dealer.profile-change.approved', reason: null });
    expect(
      decided &&
        jobOf(event('DealerProfileChangeDecided', { published: false, reason: 'No.' }), decided),
    ).toMatchObject({ template: 'dealer.profile-change.rejected', reason: 'No.' });
  });

  it('keys the claim email on the verification, and drops a malformed event', () => {
    const [rule] = NOTIFICATION_RULES.DealerEmailVerificationRequested ?? [];
    expect(
      rule && jobOf(event('DealerEmailVerificationRequested', { verificationId: 'ver-1' }), rule),
    ).toMatchObject({ subjectId: 'ver-1' });
    expect(rule && jobOf(event('DealerEmailVerificationRequested', {}), rule)).toBeNull();
  });
});
