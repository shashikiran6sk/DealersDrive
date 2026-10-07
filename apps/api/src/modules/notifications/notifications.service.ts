import {
  ADMIN_PERMISSIONS,
  formatRegistration,
  supportTicketReference,
  SupportTicketStatus,
  vehicleTitle,
  type AdminPermission,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { DomainEvent, DomainEventType, EventBus } from '../../platform/events/bus.js';
import { recordNotification } from '../../platform/telemetry/metrics.js';
import type { Queue } from '../../platform/jobs/queue.js';
import type { MailerPort } from '../../platform/mail/mail.port.js';
import { PermanentMailError } from '../../platform/mail/resend.adapter.js';
import { errorCode, isRecord } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import type { DealerClaimsService } from '../dealer-claims/dealer-claims.facade.js';
import { isAdmitted } from '../auth/auth.facade.js';
import { NOTIFICATION_RULES, payloadOf, type NotificationRule } from './notification.rules.js';
import {
  render,
  type EnquiryContext,
  type ListingContext,
  type TemplateContext,
  type TemplateName,
} from './templates.js';

export interface NotificationsDeps {
  prisma: PrismaClient;
  queue: Queue;
  mailer: MailerPort;
  claimLinks?: Pick<DealerClaimsService, 'issueLink'>;
}

export interface EmailJob extends Record<string, unknown> {
  template: TemplateName;
  dealerId: string | null;
  audience: 'dealer' | 'admin' | 'user';
  subjectId: string;
  reason?: string | null;
  profileChangeId?: string;
  permission?: string;
  userId?: string;
  listingId?: string;
  enquiryId?: string;
  ticketId?: string;
  ticketStatus?: string;
}

export const MAX_DELIVERY_ATTEMPTS = 6;

export function createNotificationsService({
  prisma,
  queue,
  mailer,
  claimLinks,
}: NotificationsDeps) {
  async function enqueue(job: EmailJob): Promise<void> {
    await queue.send('notification.email', job);
    logger.info(
      { job: 'notification.email', template: job.template, dealerId: job.dealerId },
      'email queued',
    );
  }

  return {
    subscribe(bus: EventBus): void {
      for (const [type, rules] of Object.entries(NOTIFICATION_RULES)) {
        if (!isDomainEventType(type) || !rules) continue;
        bus.on(
          type,
          async (event) => {
            for (const rule of rules) {
              const job = jobOf(event, rule);
              if (job) await enqueue(job);
            }
          },
          { required: true },
        );
      }
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
    if (job.template === 'dealer.email.verify') {
      await sendClaimLink(job);
      return;
    }

    if (job.ticketId) {
      await sendTicketMail(job, job.ticketId);
      return;
    }

    const dealerId = job.dealerId;
    if (!dealerId) {
      logger.warn({ template: job.template }, 'email skipped — no dealer');
      return;
    }

    if (job.template === 'dealer.application.rejected') {
      const snapshot = await rejectedApplicationSnapshot(dealerId);
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
      where: { id: dealerId },
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

    const listing = job.listingId ? await listingContext(job.listingId) : null;
    if (job.listingId && !listing) {
      logger.warn(
        { template: job.template, listingId: job.listingId },
        'email skipped — no listing',
      );
      return;
    }

    const enquiry = job.enquiryId ? await enquiryContext(job.enquiryId) : null;
    if (job.enquiryId && !enquiry) {
      logger.warn(
        { template: job.template, enquiryId: job.enquiryId },
        'email skipped — no enquiry',
      );
      return;
    }

    for (const recipient of recipients) {
      await sendOne(job, recipient, {
        dealerName: dealer.brandName || dealer.legalName,
        contactName: recipient.name,
        reason: job.reason ?? null,
        tagline: proposal ? proposal.tagline : dealer.tagline,
        specialities: proposal ? proposal.specialities : dealer.specialities,
        dealerSlug: dealer.slug,
        ...(listing ? { listing } : {}),
        ...(enquiry ? { enquiry } : {}),
      });
    }
  }

  async function enquiryContext(enquiryId: string): Promise<EnquiryContext | null> {
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      select: { message: true, customer: { select: { fullName: true } } },
    });
    if (!enquiry) return null;
    return { buyerName: firstNameOf(enquiry.customer.fullName), message: enquiry.message };
  }

  async function sendTicketMail(job: EmailJob, ticketId: string): Promise<void> {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, number: true, subject: true, category: true, status: true },
    });
    if (!ticket) {
      logger.warn({ template: job.template, ticketId }, 'email skipped — no ticket');
      return;
    }

    const recipients = await recipientsFor(job);
    if (recipients.length === 0) {
      logger.warn(
        { template: job.template, ticketId, audience: job.audience },
        'email skipped — no recipient',
      );
      return;
    }

    const status = SupportTicketStatus.safeParse(job.ticketStatus);
    for (const recipient of recipients) {
      await sendOne(
        job,
        recipient,
        {
          dealerName: '',
          contactName: job.audience === 'user' ? recipient.name : null,
          ticket: {
            id: ticket.id,
            reference: supportTicketReference(ticket.number),
            subject: ticket.subject,
            category: ticket.category,
            status: status.success ? status.data : ticket.status,
          },
        },
        null,
      );
    }
  }

  async function listingContext(listingId: string): Promise<ListingContext | null> {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        slug: true,
        vehicleId: true,
        vehicle: {
          select: {
            manufacturingYear: true,
            make: true,
            model: true,
            variant: true,
            registrationNumber: true,
          },
        },
      },
    });
    if (!listing) return null;
    const plate = formatRegistration(listing.vehicle.registrationNumber);
    return {
      id: listing.id,
      vehicleId: listing.vehicleId,
      slug: listing.slug,
      title: vehicleTitle(listing.vehicle) || plate,
      plate,
    };
  }

  async function sendClaimLink(job: EmailJob): Promise<void> {
    if (!claimLinks) {
      logger.warn({ template: job.template, dealerId: job.dealerId }, 'email skipped — no links');
      return;
    }
    const sent = await prisma.notificationDelivery.findFirst({
      where: {
        template: job.template,
        dedupeKey: { startsWith: `${job.template}:${job.subjectId}:` },
        status: 'SENT',
      },
      select: { id: true },
    });
    if (sent) {
      logger.debug({ subjectId: job.subjectId }, 'verification email already sent — skipping');
      return;
    }
    const link = await claimLinks.issueLink(job.subjectId);
    if (!link) {
      logger.info(
        { template: job.template, dealerId: job.dealerId },
        'email skipped — verification superseded or claimed',
      );
      return;
    }
    await sendOne(
      job,
      { email: link.email, name: link.name },
      {
        dealerName: link.dealerName,
        contactName: link.name,
        actionUrl: link.url,
        expiresAt: link.expiresAt,
      },
    );
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
    let attempts = 1;
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
          recordNotification(job.template, 'duplicate');
          return;
        }

        await prisma.notificationDelivery.update({
          where: { dedupeKey },
          data: { attempts: { increment: 1 }, status: 'PENDING' },
        });
        claimed = existing;
        attempts = (existing?.attempts ?? 0) + 1;
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

      recordNotification(job.template, 'sent');
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
      const exhausted = attempts >= MAX_DELIVERY_ATTEMPTS;
      const permanent = error instanceof PermanentMailError || exhausted;
      const detail = error instanceof Error ? error.message.slice(0, 500) : String(error);

      await prisma.notificationDelivery.update({
        where: { dedupeKey },
        data: {
          status: permanent ? 'FAILED' : 'PENDING',
          lastError: detail,
        },
      });

      recordNotification(job.template, permanent ? 'failed' : 'retry');
      logger.error(
        {
          channel: 'email',
          template: job.template,
          dealerId: job.dealerId,
          permanent,
          exhausted,
          attempts,
          err: error,
        },
        'email failed',
      );

      if (!permanent) throw error;
    }
  }

  async function recipientsFor(job: EmailJob): Promise<{ email: string; name: string | null }[]> {
    if (job.audience === 'admin') return adminRecipients(job.permission);
    if (job.audience === 'user') return userRecipients(job.userId);
    if (!job.dealerId) return [];

    const owner = await prisma.dealerMember.findFirst({
      where: { dealerId: job.dealerId, role: 'OWNER', status: 'ACTIVE' },
      select: { user: { select: { email: true, fullName: true } } },
    });

    const email = owner?.user.email;
    if (email) return [{ email, name: owner.user.fullName }];

    const assisted = await prisma.dealer.findFirst({
      where: {
        id: job.dealerId,
        onboardingSource: 'ASSISTED',
        contactEmail: { not: null },
        contactEmailVerifiedAt: { not: null },
      },
      select: { contactEmail: true, contactName: true },
    });
    return assisted?.contactEmail
      ? [{ email: assisted.contactEmail, name: assisted.contactName }]
      : [];
  }

  async function adminRecipients(
    permission: string | undefined,
  ): Promise<{ email: string; name: string | null }[]> {
    const allowlist = env.adminAllowlist.map((email) => ({ email, name: null }));
    const roles =
      permission && isAdminPermission(permission) ? ADMIN_PERMISSIONS[permission] : null;
    if (!roles) return allowlist;

    const members = await prisma.adminMember.findMany({
      where: { status: 'ACTIVE', role: { in: [...roles] } },
      select: {
        status: true,
        source: true,
        role: true,
        user: { select: { email: true, fullName: true, status: true } },
      },
    });
    const seen = new Set<string>();
    const recipients: { email: string; name: string | null }[] = [];
    for (const member of members) {
      const email = member.user.email;
      if (!email || !isAdmitted({ email, status: member.user.status, member })) continue;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      recipients.push({ email, name: member.user.fullName });
    }
    if (recipients.length > 0) return recipients;

    logger.warn({ permission }, 'no admin member holds this permission — using the allow-list');
    return allowlist;
  }

  async function userRecipients(
    userId: string | undefined,
  ): Promise<{ email: string; name: string | null }[]> {
    if (!userId) return [];
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true, fullName: true, status: true },
    });
    if (!user?.email || !user.emailVerifiedAt || user.status !== 'ACTIVE') return [];
    return [{ email: user.email, name: user.fullName }];
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

const EVENT_TYPES = new Set<string>(Object.keys(NOTIFICATION_RULES));

function isDomainEventType(value: string): value is DomainEventType {
  return EVENT_TYPES.has(value);
}

export function jobOf(event: DomainEvent, rule: NotificationRule): EmailJob | null {
  const payload = payloadOf(event);
  const template = typeof rule.template === 'function' ? rule.template(event) : rule.template;
  const subjectId = rule.subjectKey ? stringOf(payload[rule.subjectKey]) : event.id;
  if (!subjectId) return null;

  const job: EmailJob = {
    template,
    audience:
      rule.audience.kind === 'admins' ? 'admin' : rule.audience.kind === 'user' ? 'user' : 'dealer',
    dealerId: rule.ticketId ? null : (event.dealerId ?? event.aggregateId),
    subjectId,
  };
  if (rule.audience.kind === 'admins') job.permission = rule.audience.permission;
  if (rule.audience.kind === 'user') {
    const userId = stringOf(payload[rule.audience.userIdKey]);
    if (!userId) return null;
    job.userId = userId;
  }
  const withReason = typeof rule.reason === 'function' ? rule.reason(event) : rule.reason;
  if (withReason) job.reason = reasonOf(event);
  else if (rule.reason !== undefined) job.reason = null;
  if (rule.listingId) {
    const listingId = stringOf(payload.listingId);
    if (listingId) job.listingId = listingId;
  }
  if (rule.enquiryId) {
    const enquiryId = stringOf(payload.enquiryId);
    if (enquiryId) job.enquiryId = enquiryId;
  }
  if (rule.ticketId) {
    const ticketId = stringOf(payload.ticketId);
    if (!ticketId) return null;
    job.ticketId = ticketId;
    const status = stringOf(payload.status);
    if (status) job.ticketStatus = status;
  }
  if (rule.profileChangeId) {
    const profileChangeId = stringOf(payload.profileChangeId);
    if (profileChangeId) job.profileChangeId = profileChangeId;
  }
  return job;
}

function reasonOf(event: DomainEvent): string | null {
  const reason = payloadOf(event).reason;
  return typeof reason === 'string' ? reason : null;
}

function isAdminPermission(value: string): value is AdminPermission {
  return Object.hasOwn(ADMIN_PERMISSIONS, value);
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return isRecord(value) && !Array.isArray(value) ? value : null;
}

function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function firstNameOf(fullName: string | null): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === 'P2002';
}
