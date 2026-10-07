import type { AdminPermission } from '@dealers-drive/contracts';

import type { DomainEvent, DomainEventType } from '../../platform/events/bus.js';
import { isRecord } from '../../platform/errors.js';
import type { TemplateName } from './templates.js';

export type NotificationAudience =
  | { kind: 'dealer' }
  | { kind: 'admins'; permission: AdminPermission }
  | { kind: 'user'; userIdKey: string };

export interface NotificationRule {
  template: TemplateName | ((event: DomainEvent) => TemplateName);
  audience: NotificationAudience;
  reason?: boolean | ((event: DomainEvent) => boolean);
  profileChangeId?: boolean;
  subjectKey?: string;
}

export function payloadOf(event: DomainEvent): Record<string, unknown> {
  return isRecord(event.payload) && !Array.isArray(event.payload) ? event.payload : {};
}

function flag(key: string) {
  return (event: DomainEvent): boolean => payloadOf(event)[key] === true;
}

const resubmitted = flag('resubmitted');
const published = flag('published');

const DEALER = { kind: 'dealer' } as const;

function admins(permission: AdminPermission): NotificationAudience {
  return { kind: 'admins', permission };
}

export const NOTIFICATION_RULES: Partial<Record<DomainEventType, readonly NotificationRule[]>> = {
  DealerApplied: [
    {
      template: (event) =>
        resubmitted(event) ? 'dealer.application.resubmitted' : 'dealer.application.received',
      audience: DEALER,
    },
    {
      template: (event) =>
        resubmitted(event) ? 'admin.application.resubmitted' : 'admin.application.received',
      audience: admins('admin:dealer:approve'),
    },
  ],
  DealerApproved: [{ template: 'dealer.application.approved', audience: DEALER }],
  DealerRejected: [{ template: 'dealer.application.rejected', audience: DEALER, reason: true }],
  DealerChangesRequested: [
    { template: 'dealer.application.changes-requested', audience: DEALER, reason: true },
  ],
  DealerApplicationClosed: [
    { template: 'dealer.application.closed', audience: DEALER, reason: true },
  ],
  DealerSuspended: [{ template: 'dealer.account.suspended', audience: DEALER, reason: true }],
  DealerReinstated: [{ template: 'dealer.account.reinstated', audience: DEALER }],
  DealerEmailVerificationRequested: [
    { template: 'dealer.email.verify', audience: DEALER, subjectKey: 'verificationId' },
  ],
  DealerProfileChangeSubmitted: [
    {
      template: 'admin.profile-change.submitted',
      audience: admins('admin:dealer:approve'),
      profileChangeId: true,
    },
  ],
  DealerProfileChangeDecided: [
    {
      template: (event) =>
        published(event) ? 'dealer.profile-change.approved' : 'dealer.profile-change.rejected',
      audience: DEALER,
      reason: (event) => !published(event),
    },
  ],
};
