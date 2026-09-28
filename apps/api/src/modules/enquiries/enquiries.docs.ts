import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const enquiriesDocs: ModuleDocs = {
  tag: DOC_TAGS.enquiries,
  description:
    'A customer asks a dealership about one of its cars (**R64**, revises F088). The customer ' +
    'is signed in with a proved phone (R62), and **who they are is never in the request**: ' +
    'the name and number the dealership receives are read from the account, so the number a ' +
    'dealer rings is always one somebody proved they hold. The dealership is the listing’s, ' +
    'never a field in the body (rule 1).\n\n' +
    '**The dealership’s inbox** (**R66**, revises F091) reads and moves them. Every path is ' +
    'scoped to the dealership in the session — another dealership’s enquiry is a 404, never ' +
    'a 403 — and every response is `Cache-Control: no-store`, because it carries customers’ ' +
    'phone numbers.',
  operations: [
    {
      method: 'post',
      path: '/v1/enquiries',
      operationId: 'createEnquiry',
      tag: DOC_TAGS.enquiries,
      summary: 'Enquire about a car',
      description:
        'Takes **which car** — `listingSlug`, the listing’s public address — and an optional ' +
        'message, and nothing else. No name, no phone, no `dealerId`: the body is `.strict()`, ' +
        'so sending one is a 400 that names it. An empty or whitespace-only message is stored ' +
        'as no message.\n\n' +
        '**Only a car that is on the marketplace right now** — listing `ACTIVE` and its ' +
        'dealership `ACTIVE`, the same rule the public pages use. A car sold, removed or ' +
        'taken down between opening its page and pressing Send is `409 LISTING_NOT_AVAILABLE`; ' +
        'a slug that was never a listing is `404 LISTING_NOT_FOUND`.\n\n' +
        '**One enquiry per car per day.** A second enquiry from the same customer about the ' +
        'same car within 24 hours is `409 ENQUIRY_ALREADY_SUBMITTED_RECENTLY` — the dealership ' +
        'already has their details — and two presses at once cannot both land: the check and ' +
        'the write are serialised per customer and car. A follow-up the next day is allowed.' +
        '\n\n' +
        '`422 ENQUIRY_OWN_LISTING` for a dealer enquiring about their own dealership’s car.\n\n' +
        'Rate-limited to 10 an hour per customer and 30 an hour per IP.',
      audience: 'customer',
      requestBody: {
        schema: 'CreateEnquiryInput',
        example: {
          listingSlug: '2023-hyundai-creta-sx-o-katpadi-k3f9',
          message: 'Can I visit tomorrow?',
        },
      },
      responses: [
        {
          status: 201,
          description: 'The dealership has the enquiry.',
          schema: 'EnquiryReceipt',
          example: {
            id: '6d1c2f40-8e7a-4b1c-9d3e-2a4b5c6d7e8f',
            status: 'NEW',
            createdAt: '2026-09-28T10:30:00.000Z',
            dealerName: 'Sri Lakshmi Motors',
            vehicleTitle: '2023 Hyundai Creta SX(O)',
          },
        },
      ],
      errors: [404, 409, 422, 429],
    },
    {
      method: 'get',
      path: '/v1/dealer/enquiries',
      operationId: 'listDealerEnquiries',
      tag: DOC_TAGS.enquiries,
      summary: 'Your enquiries',
      description:
        'The dealership’s enquiries, newest first. `status` filters to one inbox tab ' +
        '(`NEW`, `CONTACTED`, `CLOSED`, `SPAM`); without it, all of them. Cursor-paginated.\n\n' +
        'Each carries the customer’s **current name and proved mobile**, read from their ' +
        'account as the inbox renders — never text somebody typed — with a `tel:` link, and ' +
        'the car with a link to its public page while it is on the marketplace.\n\n' +
        '`counts` gives every tab plus `ALL`, unaffected by the filter, so the tabs need no ' +
        'second request.',
      audience: 'dealer',
      permission: 'enquiry:read',
      query: 'DealerEnquiryQuery',
      responses: [
        {
          status: 200,
          description: 'A page of the inbox.',
          schema: 'DealerEnquiriesResponse',
        },
      ],
      errors: [400, 401, 403, 409],
    },
    {
      method: 'get',
      path: '/v1/dealer/enquiries/counts',
      operationId: 'countDealerEnquiries',
      tag: DOC_TAGS.enquiries,
      summary: 'How many enquiries are in each tab',
      description:
        'The same `counts` the list carries, without the rows — for a badge that should not ' +
        'fetch a page of customers to show a number.',
      audience: 'dealer',
      permission: 'enquiry:read',
      responses: [
        {
          status: 200,
          description: 'The count in each tab.',
          schema: 'DealerEnquiryCounts',
          example: { ALL: 12, NEW: 3, CONTACTED: 6, CLOSED: 2, SPAM: 1 },
        },
      ],
      errors: [401, 403],
    },
    {
      method: 'patch',
      path: '/v1/dealer/enquiries/:id',
      operationId: 'updateDealerEnquiry',
      tag: DOC_TAGS.enquiries,
      summary: 'Move an enquiry to another tab',
      description:
        'Mark contacted, close, mark as spam, or reopen as new. Any status may follow any ' +
        'other, so a mistaken Close is undone by choosing the right one. `contactedAt` is set ' +
        'the first time an enquiry is marked contacted and kept after; `closedAt` is set on ' +
        'close and cleared when it is reopened.\n\n' +
        'Setting the status it already has changes nothing and records nothing. A change is ' +
        'audited as `enquiry.contacted`, `enquiry.closed`, `enquiry.spam` or ' +
        '`enquiry.reopened`, against the dealership, with the status before and after.\n\n' +
        'Only `status` is accepted — the body is `.strict()`, so a customer’s name, number or ' +
        'message cannot be edited here.',
      audience: 'dealer',
      permission: 'enquiry:update',
      params: 'IdParam',
      requestBody: { schema: 'UpdateEnquiryInput', example: { status: 'CONTACTED' } },
      responses: [{ status: 200, description: 'The enquiry, moved.', schema: 'DealerEnquiry' }],
      errors: [400, 401, 403, 404],
    },
  ],
};
