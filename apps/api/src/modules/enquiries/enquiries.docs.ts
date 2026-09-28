import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const enquiriesDocs: ModuleDocs = {
  tag: DOC_TAGS.enquiries,
  description:
    'A customer asks a dealership about one of its cars (**R64**, revises F088). The customer ' +
    'is signed in with a proved phone (R62), and **who they are is never in the request**: ' +
    'the name and number the dealership receives are read from the account, so the number a ' +
    'dealer rings is always one somebody proved they hold. The dealership is the listing’s, ' +
    'never a field in the body (rule 1).',
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
        'as no message.\\n\\n' +
        '**Only a car that is on the marketplace right now** — listing `ACTIVE` and its ' +
        'dealership `ACTIVE`, the same rule the public pages use. A car sold, removed or ' +
        'taken down between opening its page and pressing Send is `409 LISTING_NOT_AVAILABLE`; ' +
        'a slug that was never a listing is `404 LISTING_NOT_FOUND`.\\n\\n' +
        '**One enquiry per car per day.** A second enquiry from the same customer about the ' +
        'same car within 24 hours is `409 ENQUIRY_ALREADY_SUBMITTED_RECENTLY` — the dealership ' +
        'already has their details — and two presses at once cannot both land: the check and ' +
        'the write are serialised per customer and car. A follow-up the next day is allowed.' +
        '\\n\\n' +
        '`422 ENQUIRY_OWN_LISTING` for a dealer enquiring about their own dealership’s car.\\n\\n' +
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
  ],
};
