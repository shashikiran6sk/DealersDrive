import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const supportAdminDocs: ModuleDocs = {
  tag: DOC_TAGS.supportAdmin,
  description:
    'The admin’s support ticket workspace (**R91**) over the same tickets customers raise ' +
    '(R90). Every route is admin-only and requires `admin:support:manage` (SUPPORT, ' +
    'MODERATOR, SUPER_ADMIN); a customer or dealer session is refused at the mount.\n\n' +
    'Two kinds of writing, kept apart by route rather than by a flag: a **reply** is ' +
    'customer-visible and joins the conversation; an **internal note** is a separate record ' +
    'that no customer route ever reads. Status moves follow `SUPPORT_TICKET_TRANSITIONS` ' +
    '(contracts); `CLOSED` is final. Status, priority and assignment changes are audited ' +
    'with the operator, and form the ticket’s history.\n\n' +
    'Every response is `Cache-Control: no-store`. Nothing here sends a notification.',
  operations: [
    {
      method: 'get',
      path: '/v1/admin/support/tickets',
      operationId: 'listAdminSupportTickets',
      tag: DOC_TAGS.supportAdmin,
      summary: 'The support ticket queue',
      description:
        'Tickets most recently active first, keyset-paginated. Filter by `status`, ' +
        '`category`, `priority`, `assignee` (`me`, `unassigned` or an admin’s user id) and the ' +
        'IST day created (`from`, `to`). `q` matches the reference (`DD-1042` or `1042`), the ' +
        'subject, the customer’s name or mobile, and the dealership or car of the enquiry a ' +
        'ticket is about.\n\n' +
        '`counts` is per status under every filter except `status`. `assignees` is every ' +
        'active admin a ticket can be assigned to.',
      audience: 'admin',
      permission: 'admin:support:manage',
      query: 'AdminSupportTicketQuery',
      responses: [
        { status: 200, description: 'A page of tickets.', schema: 'AdminSupportTicketsResponse' },
      ],
      errors: [400, 401, 403, 409],
    },
    {
      method: 'get',
      path: '/v1/admin/support/tickets/:id',
      operationId: 'getAdminSupportTicket',
      tag: DOC_TAGS.supportAdmin,
      summary: 'One ticket, with everything needed to resolve it',
      description:
        'The ticket; the customer (name, proved mobile, how many tickets they have raised); ' +
        'the enquiry it references, with its dealership and car — photograph, plate, current ' +
        'listing status and links — read through that one reference; the public conversation ' +
        'with each author named; the internal notes; the history from the audit trail; the ' +
        'statuses it may move to now; and the operators it can be assigned to.',
      audience: 'admin',
      permission: 'admin:support:manage',
      params: 'IdParam',
      responses: [{ status: 200, description: 'The ticket.', schema: 'AdminSupportTicketDetail' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'patch',
      path: '/v1/admin/support/tickets/:id',
      operationId: 'updateAdminSupportTicket',
      tag: DOC_TAGS.supportAdmin,
      summary: 'Change status, priority or assignee',
      description:
        'Any of the three, at least one. A status move not in `SUPPORT_TICKET_TRANSITIONS` is ' +
        '`409 SUPPORT_TICKET_TRANSITION`; resolving stamps `resolvedAt`, closing stamps ' +
        '`closedAt`, reopening a resolved ticket clears `resolvedAt`. `assignedAdminId` must be ' +
        'an active platform admin (`422 SUPPORT_ASSIGNEE_INVALID`), or `null` to unassign.\n\n' +
        'Each change is audited (`support_ticket.status_changed`, `.resolved`, `.closed`, ' +
        '`.reopened`, `.priority_changed`, `.assigned`, `.unassigned`). Only a status change ' +
        'moves the ticket’s last-activity time the customer sees; priority and assignment are ' +
        'internal.',
      audience: 'admin',
      permission: 'admin:support:manage',
      params: 'IdParam',
      requestBody: {
        schema: 'UpdateSupportTicketInput',
        example: { status: 'IN_PROGRESS', priority: 'HIGH' },
      },
      responses: [
        { status: 200, description: 'The ticket, changed.', schema: 'AdminSupportTicketDetail' },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'post',
      path: '/v1/admin/support/tickets/:id/messages',
      operationId: 'replyAsSupport',
      tag: DOC_TAGS.supportAdmin,
      summary: 'Reply to the customer',
      description:
        'Adds a customer-visible message, authored as support by the signed-in operator. The ' +
        'customer sees it from “Dealers-Drive support”, never the operator’s name. A closed ' +
        'ticket takes no reply (`409 SUPPORT_TICKET_CLOSED`). The status does not change; ' +
        'set it separately.',
      audience: 'admin',
      permission: 'admin:support:manage',
      params: 'IdParam',
      requestBody: {
        schema: 'SupportMessageInput',
        example: { message: 'We have asked the dealership to call you today.' },
      },
      responses: [
        {
          status: 201,
          description: 'The ticket, with the reply.',
          schema: 'AdminSupportTicketDetail',
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/support/tickets/:id/notes',
      operationId: 'addSupportInternalNote',
      tag: DOC_TAGS.supportAdmin,
      summary: 'Add an internal note',
      description:
        'A private note for Dealers-Drive admins — “called the dealer at 14:32”. Stored apart ' +
        'from the conversation and returned only by these admin routes; the customer’s ' +
        'ticket response has no field for it. Does not change the ticket’s last-activity ' +
        'time, so the customer cannot infer one was written.',
      audience: 'admin',
      permission: 'admin:support:manage',
      params: 'IdParam',
      requestBody: {
        schema: 'SupportNoteInput',
        example: { note: 'Called the dealer at 14:32; they will ring the customer today.' },
      },
      responses: [
        {
          status: 201,
          description: 'The ticket, with the note.',
          schema: 'AdminSupportTicketDetail',
        },
      ],
      errors: [400, 401, 403, 404],
    },
  ],
};
