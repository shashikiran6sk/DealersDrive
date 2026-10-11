import { z } from 'zod';

import { CursorPage, Uuid } from './common.js';
import { StatusTone } from './enums.js';

/**
 * ── The notification delivery log (R115) ───────────────────────────────────
 *
 * Every email the platform tries to send has one `notification_deliveries`
 * row: claimed before the provider is called, so a retried job never sends
 * twice, and left SENT, PENDING (will be retried) or FAILED (will not). This is
 * the operator's read of that table — the answer to "did the dealer get it?".
 *
 * Recipient addresses are personal data, so it is a Super-admin read.
 */
export const NotificationStatus = z.enum(['PENDING', 'SENT', 'FAILED']);
export type NotificationStatus = z.infer<typeof NotificationStatus>;

/** **R118.** Email, or a transactional SMS sent through MSG91. */
export const NotificationChannel = z.enum(['EMAIL', 'SMS']);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
};

export const AdminNotificationsQuery = z
  .object({
    status: NotificationStatus.optional(),
    q: z.string().trim().min(1).max(120).optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type AdminNotificationsQuery = z.infer<typeof AdminNotificationsQuery>;

export const AdminNotificationRow = z.object({
  id: Uuid,
  template: z.string(),
  channel: NotificationChannel,
  recipient: z.string(),
  subject: z.string(),
  status: NotificationStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  dealer: z.object({ id: Uuid, name: z.string() }).nullable(),
  createdAt: z.string(),
  createdLabel: z.string(),
  sentAt: z.string().nullable(),
});
export type AdminNotificationRow = z.infer<typeof AdminNotificationRow>;

export const AdminNotificationsResponse = z.object({
  data: z.array(AdminNotificationRow),
  page: CursorPage,
  counts: z.object({
    ALL: z.number().int(),
    PENDING: z.number().int(),
    SENT: z.number().int(),
    FAILED: z.number().int(),
  }),
});
export type AdminNotificationsResponse = z.infer<typeof AdminNotificationsResponse>;

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  PENDING: 'Retrying',
  SENT: 'Sent',
  FAILED: 'Failed',
};

export const NOTIFICATION_STATUS_TONES: Record<NotificationStatus, StatusTone> = {
  PENDING: 'warn',
  SENT: 'ok',
  FAILED: 'err',
};
