import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const supportDocs: ModuleDocs = {
  tag: DOC_TAGS.support,
  description:
    'Support requests (**R90**): a signed-in customer asking Dealers-Drive itself for help — ' +
    'a question, an account problem, or an issue with a dealership, a car or an enquiry. ' +
    'Separate from enquiries, which are a customer talking to a dealership.\n\n' +
    '**Who is asking is the session**, never a field: every path here is behind the customer ' +
    'guard and every read and write is scoped to that customer. Another customer’s request ' +
    'is a 404, never a 403, so a reference cannot be probed for existence. A request may ' +
    'point at one of the customer’s **own** enquiries; the dealership and the car are reached ' +
    'through it, never sent. Nothing support keeps to itself — priority, assignment, ' +
    'internal notes, the audit trail — is selected for any response here.\n\n' +
    'Every response is `Cache-Control: no-store`. No notification is sent by anything here.',
  operations: [
    {
      method: 'get',
      path: '/v1/support/tickets',
      operationId: 'listMySupportTickets',
      tag: DOC_TAGS.support,
      summary: 'Your support requests',
      description:
        'The signed-in customer’s own requests, most recently active first (a reply moves a ' +
        'request to the top), keyset-paginated. `reference` (`DD-1042`) is what the customer ' +
        'quotes; `statusLabel` is worded for the customer.',
      audience: 'customer',
      query: 'CustomerSupportTicketQuery',
      responses: [
        {
          status: 200,
          description: 'A page of requests.',
          schema: 'CustomerSupportTicketsResponse',
        },
      ],
      errors: [400, 401, 409],
    },
    {
      method: 'post',
      path: '/v1/support/tickets',
      operationId: 'createSupportTicket',
      tag: DOC_TAGS.support,
      summary: 'Create a support request',
      description:
        'A category, a subject (5–120 characters) and a description (20–5,000), and ' +
        'optionally one of the customer’s own enquiries. An `enquiryId` that is not theirs is ' +
        'refused exactly as one that does not exist (`422 SUPPORT_ENQUIRY_INVALID`). The ' +
        'request starts `OPEN` at `NORMAL` priority; neither can be sent. Its `DD-` number ' +
        'comes from a database sequence, so concurrent requests never share one.\n\n' +
        'Audited as `support_ticket.created` with the number, category and enquiry — never the ' +
        'subject or description.',
      audience: 'customer',
      requestBody: {
        schema: 'CreateSupportTicketInput',
        example: {
          category: 'ENQUIRY_ISSUE',
          subject: 'The dealer has not called me back',
          description:
            'I enquired about the Honda City three days ago and nobody has contacted me yet.',
          enquiryId: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
        },
      },
      responses: [
        { status: 201, description: 'The request, created.', schema: 'CustomerSupportTicket' },
      ],
      errors: [400, 401, 422, 429],
      rateLimit: '5 per customer and 20 per IP, per hour.',
    },
    {
      method: 'get',
      path: '/v1/support/tickets/:id',
      operationId: 'getMySupportTicket',
      tag: DOC_TAGS.support,
      summary: 'One of your support requests',
      description:
        'The request with its opening description, the public conversation in order — support ' +
        'replies read as “Dealers-Drive support”, never an operator’s name — the referenced ' +
        'enquiry as the customer’s own page shows it, and `canReply` (false once closed).',
      audience: 'customer',
      params: 'IdParam',
      responses: [{ status: 200, description: 'The request.', schema: 'CustomerSupportTicket' }],
      errors: [400, 401, 404],
    },
    {
      method: 'post',
      path: '/v1/support/tickets/:id/messages',
      operationId: 'replyToSupportTicket',
      tag: DOC_TAGS.support,
      summary: 'Reply on a support request',
      description:
        'Adds the customer’s message to the conversation. A request waiting for the customer ' +
        'goes back to `IN_PROGRESS`; a `RESOLVED` one reopens to `OPEN` (audited as ' +
        '`support_ticket.reopened`). A `CLOSED` request takes no reply: ' +
        '`409 SUPPORT_TICKET_CLOSED`, and the customer is pointed at a new request. ' +
        'Up to five successfully persisted customer messages are allowed after the latest genuine support reply. ' +
        'The original description is a separate ticket field and is not an additional message. ' +
        'A ticket row lock makes the quota atomic. The sixth reply returns 409 SUPPORT_MESSAGE_LIMIT_REACHED. ' +
        'An optional clientMessageId UUID makes a retry idempotent; reusing it with different text returns 409 SUPPORT_MESSAGE_RETRY_CONFLICT. ' +
        'Retries preserve quota and timestamps. Internal notes and lifecycle changes never reset it. ' +
        'Customer detail exposes remainingMessages and canReply. Urgent help is available through /contact without bypassing this quota.',
      audience: 'customer',
      params: 'IdParam',
      requestBody: {
        schema: 'SupportMessageInput',
        example: { message: 'Thanks — the dealer called this morning.' },
      },
      responses: [
        {
          status: 201,
          description: 'The request, with the reply added.',
          schema: 'CustomerSupportTicket',
        },
      ],
      errors: [400, 401, 404, 409, 429],
      rateLimit: '30 per customer, per hour.',
    },
  ],
};
