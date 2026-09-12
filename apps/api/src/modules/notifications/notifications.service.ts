import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { DomainEvent, EventBus } from '../../platform/events/bus.js';
import type { Queue } from '../../platform/jobs/queue.js';
import type { MailerPort } from '../../platform/mail/mail.port.js';
import { PermanentMailError } from '../../platform/mail/resend.adapter.js';
import { logger } from '../../platform/telemetry/logger.js';
import { render, type TemplateContext, type TemplateName } from './templates.js';

/**
 * Who gets told what, and when (**R40**).
 *
 * ── The shape of the whole thing ────────────────────────────────────────────
 *
 *     API request
 *        ↓  validate, do the business operation
 *        ↓  enqueueOutbox(tx, …)      ← same transaction as the state change
 *        ↓  COMMIT
 *        ↓  respond                    ← the request is over here
 *
 *     Worker process
 *        ↓  OutboxPublisher polls unpublished rows
 *        ↓  bus.publish(event)  →  subscribe() below
 *        ↓  queue.send('notification.email', { … })
 *        ↓  handleEmailJob()  →  claim, render, send via Resend
 *
 * **The API never waits on Resend, and never touches it.** No route, service or
 * request handler in this codebase holds a `MailerPort`. The API's entire
 * contribution to an email is one row in `outbox_events`, written inside the
 * transaction that caused it — which is what makes the email exactly as durable
 * as the state change and no more.
 *
 * That the sending is a separate *process* rather than a `void`-ed promise is
 * the part that matters under load. A fire-and-forget `send()` in a request
 * handler still occupies the API's event loop, still holds its memory, still
 * dies with a SIGTERM mid-flight, and still has nowhere to record that it
 * failed. Queueing gives all four away: the API's tail latency is unaffected by
 * a provider having a bad minute, and a deploy that restarts the API loses
 * nothing.
 *
 * ── Two hops, and why the middle one is not skipped ─────────────────────────
 * The outbox could enqueue a pg-boss job directly instead of publishing to an
 * in-process bus. It does not, because pg-boss's `send` is not transactional
 * with the caller's write — so "the dealership was approved" and "the job
 * exists" would be two commits, and a crash between them is a dealer who is
 * verified and never told. The outbox row *is* the transactional part; the bus
 * is how it fans out; the queue is what survives a restart mid-send.
 *
 * ── Ids, never PII ──────────────────────────────────────────────────────────
 * An event payload carries a dealer id. The job payload carries a template name
 * and ids. The **worker** resolves the name and the address, at send time, out
 * of the database. An email address copied into a queue row is an address that
 * goes stale the moment the dealer changes it — and a queue is not a place to
 * keep personal data waiting.
 */
export interface NotificationsDeps {
  prisma: PrismaClient;
  queue: Queue;
  mailer: MailerPort;
}

/** What travels on the queue. Small, and resolvable — never a rendered body. */
export interface EmailJob extends Record<string, unknown> {
  template: TemplateName;
  /** The dealership the message is about. Everything else is read from it. */
  dealerId: string;
  /** `dealer` resolves to the owner's address; `admin` fans out to the allow-list. */
  audience: 'dealer' | 'admin';
  /**
   * What makes two attempts the same email.
   *
   * Derived from the **event** — its id, or the decision it carries — and never
   * from the attempt. A key generated per job would be unique per delivery and
   * would deduplicate nothing, which is the mistake this comment exists to
   * stop somebody making later.
   */
  subjectId: string;
  reason?: string | null;
  /**
   * The `DealerProfileChange` this message is about, for the two templates that
   * are about one.
   *
   * The moderator's email has to show what was **proposed**, not what is live —
   * reading the dealership row would render the very words the dealer is asking
   * to replace, which is the opposite of the question being asked. An id rather
   * than the text itself, for the same reason nothing else on a job payload is
   * PII: the worker resolves it at send time.
   */
  profileChangeId?: string;
}

export function createNotificationsService({ prisma, queue, mailer }: NotificationsDeps) {
  /**
   * The events that produce an email, and the templates they produce.
   *
   * A table rather than a switch, because the interesting property is that it
   * is **six product rules on six lines** — a reader checking "does a rejection
   * email the dealer" should not have to read a function to find out.
   */
  async function enqueue(job: EmailJob): Promise<void> {
    await queue.send('notification.email', job);
    logger.info(
      { job: 'notification.email', template: job.template, dealerId: job.dealerId },
      'email queued',
    );
  }

  return {
    /**
     * Wires the notification rules onto the bus. Called once, by the process that runs
     * the outbox — which is the worker, or the API when `WORKER_INLINE=true`.
     */
    subscribe(bus: EventBus): void {
      // 1 — a dealership submits its application: tell the dealer, and us.
      // A returned application gets explicit resubmission wording so neither
      // audience mistakes it for the first submission arriving again.
      bus.on('DealerApplied', async (event) => {
        const resubmitted = (event.payload as { resubmitted?: unknown }).resubmitted === true;
        await enqueue(
          base(
            event,
            resubmitted ? 'dealer.application.resubmitted' : 'dealer.application.received',
            'dealer',
          ),
        );
        await enqueue(
          base(
            event,
            resubmitted ? 'admin.application.resubmitted' : 'admin.application.received',
            'admin',
          ),
        );
      });

      // 2 — approved.
      bus.on('DealerApproved', async (event) => {
        await enqueue(base(event, 'dealer.application.approved', 'dealer'));
      });

      // 3 — rejected, and changes requested. Two events, two templates: they
      // mean opposite things to the dealer — one is the end of the application
      // and the other is a task — and a shared message would have to be vague
      // about which.
      bus.on('DealerRejected', async (event) => {
        await enqueue({
          ...base(event, 'dealer.application.rejected', 'dealer'),
          reason: reasonOf(event),
        });
      });

      bus.on('DealerChangesRequested', async (event) => {
        await enqueue({
          ...base(event, 'dealer.application.changes-requested', 'dealer'),
          reason: reasonOf(event),
        });
      });

      // 4 — suspension and reinstatement are both reversible account events,
      // and both must be visible to the dealer.
      bus.on('DealerSuspended', async (event) => {
        await enqueue({
          ...base(event, 'dealer.account.suspended', 'dealer'),
          reason: reasonOf(event),
        });
      });

      bus.on('DealerReinstated', async (event) => {
        await enqueue(base(event, 'dealer.account.reinstated', 'dealer'));
      });

      // 5 — a dealership proposes new public words: tell the moderators.
      bus.on('DealerProfileChangeSubmitted', async (event) => {
        const payload = event.payload as { profileChangeId?: unknown };
        await enqueue({
          ...base(event, 'admin.profile-change.submitted', 'admin'),
          // The proposal, not the live page — see `profileChangeId` above.
          ...(typeof payload.profileChangeId === 'string'
            ? { profileChangeId: payload.profileChangeId }
            : {}),
        });
      });

      // 6 and 7 — the decision on it. One event carries both verdicts, because
      // R34 chose one event for "this dealership's public words were decided
      // on"; `payload.published` is which way.
      bus.on('DealerProfileChangeDecided', async (event) => {
        const published = (event.payload as { published?: boolean }).published === true;
        await enqueue({
          ...base(
            event,
            published ? 'dealer.profile-change.approved' : 'dealer.profile-change.rejected',
            'dealer',
          ),
          reason: published ? null : reasonOf(event),
        });
      });
    },

    /** Registers the worker. Called by whichever process runs the handlers. */
    async work(): Promise<void> {
      await queue.work('notification.email', async (data) => {
        await handleEmailJob(data as unknown as EmailJob);
      });
    },

    /** Exported for the tests, which drive it directly rather than through pg-boss. */
    handleEmailJob,
  };

  /**
   * One job, one email — or none, if this one has already been sent.
   *
   * The order below is the whole idempotency argument and is not rearrangeable:
   *
   *   1. **Claim first.** Insert the `PENDING` row. The unique index on
   *      `dedupeKey` is what makes a duplicate delivery lose rather than send,
   *      and it has to happen *before* the provider is called — a claim taken
   *      afterwards would be a claim on an email that has already gone.
   *   2. **Resolve the recipient.** From the database, at send time.
   *   3. **Send.**
   *   4. **Record the outcome.**
   *
   * Step 1 failing on the unique index is the normal, expected path for a
   * redelivery. It is logged at `debug` and returns — not an error, because
   * nothing went wrong.
   */
  async function handleEmailJob(job: EmailJob): Promise<void> {
    /*
     * Rejection is the one notification whose subject is deliberately gone
     * before the outbox is published. Its non-FK audit snapshot survives the
     * purge and is therefore the source of both recipient and rendering data.
     */
    if (job.template === 'dealer.application.rejected') {
      const snapshot = await rejectedApplicationSnapshot(job.dealerId);
      if (snapshot) {
        await sendOne(
          job,
          { email: snapshot.recipientEmail, name: snapshot.recipientName },
          {
            dealerName: snapshot.dealerName,
            contactName: snapshot.recipientName,
            reason: job.reason ?? null,
          },
          // The dealer row no longer exists. A nullable delivery reference
          // preserves the send record without violating its foreign key.
          null,
        );
        return;
      }
    }

    const recipients = await recipientsFor(job);
    if (recipients.length === 0) {
      logger.warn(
        { template: job.template, dealerId: job.dealerId, audience: job.audience },
        'email skipped — no recipient',
      );
      return;
    }

    const dealer = await prisma.dealer.findUnique({
      where: { id: job.dealerId },
      select: { brandName: true, legalName: true, slug: true, tagline: true, specialities: true },
    });
    if (!dealer) {
      // The dealership was purged between the event and the job. Nothing to
      // say and nobody to say it about; this is not a failure to retry.
      logger.warn({ template: job.template, dealerId: job.dealerId }, 'email skipped — no dealer');
      return;
    }

    /*
     * The proposal, when the message is about one.
     *
     * A moderator reading "has proposed a change" over the dealership's *current*
     * tagline is reading the words the dealer wants to replace. That was a real
     * bug, caught by the integration test rather than by review, and it is the
     * reason this read exists rather than the row above it being reused.
     */
    const proposal = job.profileChangeId
      ? await prisma.dealerProfileChange.findUnique({
          where: { id: job.profileChangeId },
          select: { tagline: true, specialities: true },
        })
      : null;

    for (const recipient of recipients) {
      await sendOne(job, recipient, {
        dealerName: dealer.brandName || dealer.legalName,
        contactName: recipient.name,
        reason: job.reason ?? null,
        tagline: proposal ? proposal.tagline : dealer.tagline,
        specialities: proposal ? proposal.specialities : dealer.specialities,
        dealerSlug: dealer.slug,
      });
    }
  }

  async function sendOne(
    job: EmailJob,
    recipient: { email: string; name: string | null },
    context: TemplateContext,
    deliveryDealerId: string | null = job.dealerId,
  ): Promise<void> {
    const dedupeKey = `${job.template}:${job.subjectId}:${recipient.email.toLowerCase()}`;
    const message = render(job.template, context);

    // 1 — claim. A duplicate loses here, before anything is sent.
    let claimed;
    try {
      claimed = await prisma.notificationDelivery.create({
        data: {
          dedupeKey,
          template: job.template,
          recipient: recipient.email,
          subject: message.subject,
          dealerId: deliveryDealerId,
          attempts: 1,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await prisma.notificationDelivery.findUnique({ where: { dedupeKey } });

        /*
         * Already sent — a redelivery, which is the queue behaving correctly.
         * Not an error, and not retried.
         */
        if (existing?.status === 'SENT') {
          logger.debug({ dedupeKey }, 'email already sent — skipping');
          return;
        }

        /*
         * A PENDING or FAILED row is this job's own earlier attempt coming
         * round again. Count it and carry on: the point of a retry is to try.
         */
        await prisma.notificationDelivery.update({
          where: { dedupeKey },
          data: { attempts: { increment: 1 }, status: 'PENDING' },
        });
        claimed = existing;
      } else {
        throw error;
      }
    }

    try {
      const result = await mailer.send({
        to: recipient.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        tag: job.template,
        idempotencyKey: dedupeKey,
      });

      await prisma.notificationDelivery.update({
        where: { dedupeKey },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerMessageId: result.providerMessageId,
          lastError: null,
        },
      });

      logger.info(
        {
          channel: 'email',
          driver: mailer.driver,
          template: job.template,
          dealerId: job.dealerId,
          deliveryId: claimed?.id,
          providerMessageId: result.providerMessageId,
        },
        // This is provider acceptance, not an inbox-placement claim. Resend
        // cannot see whether Gmail subsequently chooses Inbox or Spam.
        'email accepted by provider',
      );
    } catch (error) {
      const permanent = error instanceof PermanentMailError;
      const detail = error instanceof Error ? error.message.slice(0, 500) : String(error);

      await prisma.notificationDelivery.update({
        where: { dedupeKey },
        data: {
          // Permanent means the retries would all fail the same way, so the
          // row goes straight to the list somebody works.
          status: permanent ? 'FAILED' : 'PENDING',
          lastError: detail,
        },
      });

      logger.error(
        { channel: 'email', template: job.template, dealerId: job.dealerId, permanent, err: error },
        'email failed',
      );

      /*
       * A permanent failure is swallowed *deliberately*. Rethrowing would make
       * pg-boss retry five times over twenty minutes to receive the same 422
       * from Resend, and then archive a job nobody looks at — while the row
       * that says what went wrong already exists. Anything else is rethrown, so
       * the queue's backoff does its job.
       */
      if (!permanent) throw error;
    }
  }

  /**
   * Who to write to, resolved at send time rather than carried on the job.
   *
   * A `dealer` audience is the OWNER's address — the person who applied, and
   * the only seat that can act on any of these messages. An `admin`
   * audience is `ADMIN_ALLOWLIST`, which is the same list that decides who may
   * hold an admin session: a moderation queue email going to somebody who
   * cannot open the queue would be a leak with no purpose.
   */
  async function recipientsFor(job: EmailJob): Promise<{ email: string; name: string | null }[]> {
    if (job.audience === 'admin') {
      return env.adminAllowlist.map((email) => ({ email, name: null }));
    }

    const owner = await prisma.dealerMember.findFirst({
      where: { dealerId: job.dealerId, role: 'OWNER', status: 'ACTIVE' },
      select: { user: { select: { email: true, fullName: true } } },
    });

    const email = owner?.user.email;
    return email ? [{ email, name: owner.user.fullName }] : [];
  }

  async function rejectedApplicationSnapshot(dealerId: string): Promise<{
    dealerName: string;
    recipientEmail: string;
    recipientName: string | null;
  } | null> {
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'dealer.rejected',
        entityType: 'Dealer',
        entityId: dealerId,
      },
      orderBy: { id: 'desc' },
      select: { before: true },
    });
    const before = recordOf(audit?.before);
    if (!before) return null;

    // `contactEmail` supports audit rows written before `recipientEmail`
    // was introduced, so already-queued rejection events remain deliverable.
    const recipientEmail = stringOf(before.recipientEmail) ?? stringOf(before.contactEmail);
    const dealerName = stringOf(before.brandName) ?? stringOf(before.legalName);
    if (!recipientEmail || !dealerName) return null;

    return {
      dealerName,
      recipientEmail,
      recipientName: stringOf(before.recipientName),
    };
  }
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;

/** The fields every job shares, off the event that caused it. */
function base(event: DomainEvent, template: TemplateName, audience: 'dealer' | 'admin'): EmailJob {
  return {
    template,
    audience,
    dealerId: event.dealerId ?? event.aggregateId,
    // The event id. One event, one email per recipient, however many times the
    // outbox or the queue delivers it.
    subjectId: event.id,
  };
}

/** The moderator's own sentence, when the event carries one. */
function reasonOf(event: DomainEvent): string | null {
  const payload = event.payload as { reason?: unknown };
  return typeof payload.reason === 'string' ? payload.reason : null;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Prisma's P2002. Duck-typed, so a test can throw one without the client. */
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}
