import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const notificationsDocs: ModuleDocs = {
  tag: DOC_TAGS.notifications,
  description:
    'The email delivery log (**R115**). Every email the platform tries to send is claimed as a ' +
    '`notification_deliveries` row before the provider is called, keyed so a retried job can ' +
    'never send twice. `SENT` went to the provider; `PENDING` failed and will be retried with ' +
    'backoff; `FAILED` will not be retried — a permanent refusal, or the last of six attempts. ' +
    'Recipients are personal data, so this is a Super-admin read.',
  operations: [
    {
      method: 'get',
      path: '/v1/admin/notifications',
      operationId: 'listNotificationDeliveries',
      tag: DOC_TAGS.notifications,
      summary: 'Email deliveries, newest first',
      description:
        'Filter by `status`, or search `q` across recipient, template and subject. Keyset-paginated; `counts` ignore `status` so the filter tabs stay populated.',
      audience: 'admin',
      permission: 'admin:notifications:read',
      query: 'AdminNotificationsQuery',
      responses: [
        { status: 200, description: 'A page of deliveries.', schema: 'AdminNotificationsResponse' },
      ],
      errors: [400, 401, 403],
    },
  ],
};
