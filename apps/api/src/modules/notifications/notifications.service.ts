import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { DomainEvent, EventBus } from '../../platform/events/bus.js';
import type { Queue } from '../../platform/jobs/queue.js';
import type { MailerPort } from '../../platform/mail/mail.port.js';
import { PermanentMailError } from '../../platform/mail/resend.adapter.js';
import { errorCode, isRecord } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import { render, type TemplateContext, type TemplateName } from './templates.js';

export interface NotificationsDeps {
  prisma: PrismaClient;
  queue: Queue;
  mailer: MailerPort;
}

export interface EmailJob extends Record<string, unknown> {
  template: TemplateName;
  dealerId: string;
  audience: 'dealer' | 'admin';
  subjectId: string;
  reason?: string | null;
  profileChangeId?: string;
}

export function createNotificationsService({ prisma, queue, mailer }: NotificationsDeps) {
  async function enqueue(job: EmailJob): Promise<void> {
    await queue.send('notification.email', job);
    logger.info(
      { job: 'notification.email', template: job.template, dealerId: job.dealerId },
      'email queued',
    );
  }

  return {
    subscribe(bus: EventBus): void {
      bus.on('DealerApplied', async (event) => {
        const resubmitted = recordOf(event.payload)?.resubmitted === true;
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

      bus.on('DealerApproved', async (event) => {
        await enqueue(base(event, 'dealer.application.approved', 'dealer'));
      });

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

      bus.on('DealerSuspended', async (event) => {
        await enqueue({
          ...base(event, 'dealer.account.suspended', 'dealer'),
          reason: reasonOf(event),
        });
      });

      bus.on('DealerReinstated', async (event) => {
        await enqueue(base(event, 'dealer.account.reinstated', 'dealer'));
      });

      bus.on('DealerProfileChangeSubmitted', async (event) => {
        const payload = recordOf(event.payload) ?? {};
        await enqueue({
          ...base(event, 'admin.profile-change.submitted', 'admin'),
          ...(typeof payload.profileChangeId === 'string'
            ? { profileChangeId: payload.profileChangeId }
            : {}),
        });
      });

      bus.on('DealerProfileChangeDecided', async (event) => {
        const published = recordOf(event.payload)?.published === true;
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

    async work(): Promise<void> {
      await queue.work('notification.email', async (data) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg-boss hands job data back untyped
        await handleEmailJob(data as unknown as EmailJob);
      });
    },

    handleEmailJob,
  };

  async function handleEmailJob(job: EmailJob): Promise<void> {
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
      logger.warn({ template: job.template, dealerId: job.dealerId }, 'email skipped — no dealer');
      return;
    }

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

        if (existing?.status === 'SENT') {
          logger.debug({ dedupeKey }, 'email already sent — skipping');
          return;
        }

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
        'email accepted by provider',
      );
    } catch (error) {
      const permanent = error instanceof PermanentMailError;
      const detail = error instanceof Error ? error.message.slice(0, 500) : String(error);

      await prisma.notificationDelivery.update({
        where: { dedupeKey },
        data: {
          status: permanent ? 'FAILED' : 'PENDING',
          lastError: detail,
        },
      });

      logger.error(
        { channel: 'email', template: job.template, dealerId: job.dealerId, permanent, err: error },
        'email failed',
      );

      if (!permanent) throw error;
    }
  }

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

function base(event: DomainEvent, template: TemplateName, audience: 'dealer' | 'admin'): EmailJob {
  return {
    template,
    audience,
    dealerId: event.dealerId ?? event.aggregateId,
    subjectId: event.id,
  };
}

function reasonOf(event: DomainEvent): string | null {
  const reason = recordOf(event.payload)?.reason;
  return typeof reason === 'string' ? reason : null;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return isRecord(value) && !Array.isArray(value) ? value : null;
}

function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === 'P2002';
}
