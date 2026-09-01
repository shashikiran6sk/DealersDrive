import type { ModuleDocs } from '../../docs/spec.js';

/** A7 · A15 · C15–C17. The lead is the product; everything else is plumbing. */
export const enquiriesDocs: ModuleDocs = {
  tag: 'Enquiries',
  description:
    "Buyer enquiries and phone reveals, plus the dealer's inbox. The two public endpoints " +
    'need no account — asking a dealer about a car must not require a signup — so they carry ' +
    'the hardest rate limits in the API and a honeypot field.',
  operations: [
    {
      method: 'post',
      path: '/v1/enquiries',
      operationId: 'createEnquiry',
      tag: 'Enquiries',
      summary: 'Submit an enquiry',
      description:
        'Creates a lead against **either** a vehicle or a dealership — exactly one of ' +
        '`vehicleId` and `dealerSlug`, never both and never neither (a 400 if you send the ' +
        'wrong combination).\n\n' +
        '**Deduplicated.** The same phone number asking about the same car within 24 hours ' +
        'returns `200` with `isDuplicate: true` and the *original* reference, and sends the ' +
        'dealer no second notification. Tapping submit twice must not produce two leads, and ' +
        'must not look like a failure to the buyer either — hence 200 rather than 409.\n\n' +
        '**`website` is a honeypot.** It is not a real field. A bot that fills it gets a ' +
        'normal 201 with a plausible reference and nothing is written — a bot is told ' +
        'nothing.\n\n' +
        'Phone numbers are accepted as `9876543210`, `+919876543210` or `+91 98765 43210` ' +
        'and normalised to E.164 on the way in.',
      audience: 'public',
      requestBody: {
        schema: 'CreateEnquiryInput',
        description: "The buyer's details and what they are asking about.",
        example: {
          vehicleId: '55714b20-2469-4280-87fb-1ac6ea79a9c5',
          name: 'Ravi Kumar',
          phone: '9876543210',
          email: 'ravi@example.com',
          message: 'Is this still available for a test drive this weekend?',
          source: 'LISTING_PAGE',
        },
      },
      rateLimit: '5 enquiries per hour per IP',
      responses: [
        {
          status: 201,
          description: 'The lead was created and the dealer notified.',
          schema: 'EnquiryCreatedResponse',
          example: {
            reference: 'DD-EN-10017',
            createdAt: '2026-08-17T09:12:44.000Z',
            dealer: {
              slug: 'sri-lakshmi-motors',
              brandName: 'Sri Lakshmi Motors',
              responseTimeLabel: 'typically responds within an hour',
            },
            vehicle: {
              id: '55714b20-2469-4280-87fb-1ac6ea79a9c5',
              slug: '2016-ford-ecosport-titanium-vellore-55714b',
              title: 'Ford EcoSport Titanium',
              priceLabel: '₹4.95 Lakh',
              city: 'Vellore',
              thumbnailUrl:
                'http://localhost:4000/media/vehicles/by-media/bc7de20d-30a4-41ed-a364-8f34771a20a8/320.webp',
            },
            isDuplicate: false,
          },
        },
        {
          status: 200,
          description:
            'A duplicate of a lead from the last 24 hours. Same reference, no second ' +
            'notification, `isDuplicate: true`.',
          schema: 'EnquiryCreatedResponse',
        },
      ],
      errors: [404, 429],
    },
    {
      method: 'post',
      path: '/v1/vehicles/:id/reveal-contact',
      operationId: 'revealDealerContact',
      tag: 'Enquiries',
      summary: "Reveal the dealer's phone number",
      description:
        "**The only endpoint in the API that returns a dealer's phone number.** No ordinary " +
        'public response carries one (rule 7).\n\n' +
        'A reveal is a lead: it writes a `PhoneReveal` row for abuse analysis *and* an ' +
        '`Enquiry` with `source: CALL_BUTTON`, so the dealer sees the tap in their inbox. ' +
        'Deduplicated per network and vehicle over 24 hours, so tapping Call three times is ' +
        'one lead.\n\n' +
        'Two independent caps apply per IP — an hourly one and a daily one — because each ' +
        'reveal is the thing competitors want and every notification costs real money. Both ' +
        'answer 429.\n\n' +
        'Only works for a car that is publicly visible; anything else is a 404. ' +
        '`Cache-Control: no-store`.',
      audience: 'public',
      params: 'IdParam',
      requestBody: {
        schema: 'RevealContactInput',
        description: 'Optional caller name, and a captcha token if the client was challenged.',
        required: false,
        example: { name: 'Ravi Kumar' },
      },
      rateLimit:
        '10 reveals per hour and 20 per day per IP (`reveal.hourlyCapPerIp`, `reveal.dailyCapPerIp`)',
      responses: [
        {
          status: 200,
          description: 'The number, with tap-to-call and WhatsApp links.',
          schema: 'RevealContactResponse',
          contentType: 'application/json',
          example: {
            phone: '+919840012345',
            phoneDisplay: '+91 98400 12345',
            dealer: { slug: 'sri-lakshmi-motors', brandName: 'Sri Lakshmi Motors' },
            callHref: 'tel:+919840012345',
            whatsappHref: 'https://wa.me/919840012345',
            revealsRemainingToday: 19,
          },
        },
      ],
      errors: [404, 429],
    },
    {
      method: 'get',
      path: '/v1/dealer/enquiries',
      operationId: 'listDealerEnquiries',
      tag: 'Enquiries',
      summary: "The dealer's inbox",
      description:
        'Leads for the acting dealership, newest first, cursor-paginated so the list stays ' +
        "stable while new leads arrive. Scoped to the session's dealer — there is no " +
        'parameter that could widen it.',
      audience: 'dealer',
      permission: 'enquiry:read',
      query: 'EnquiryQuery',
      responses: [{ status: 200, description: 'A page of leads.', schema: 'EnquiryListResponse' }],
      errors: [400, 401, 403],
    },
    {
      method: 'get',
      path: '/v1/dealer/enquiries/counts',
      operationId: 'getDealerEnquiryCounts',
      tag: 'Enquiries',
      summary: 'Inbox tab counts',
      description:
        'The number beside each inbox tab (new, contacted, closed, spam) plus the total, so ' +
        'the tabs can update without refetching every list.',
      audience: 'dealer',
      permission: 'enquiry:read',
      responses: [
        { status: 200, description: 'Counts per status.', schema: 'EnquiryCountsResponse' },
      ],
      errors: [401, 403],
    },
    {
      method: 'patch',
      path: '/v1/dealer/enquiries/:id',
      operationId: 'updateDealerEnquiry',
      tag: 'Enquiries',
      summary: "Update a lead's status",
      description:
        'Move a lead through the inbox — contacted, closed with a reason, or marked spam — ' +
        'and attach a private note.\n\n' +
        "Another dealer's enquiry id answers **404**, not 403.",
      audience: 'dealer',
      permission: 'enquiry:update',
      params: 'IdParam',
      requestBody: {
        schema: 'UpdateEnquiryInput',
        description: 'The new status, and optionally a close reason and note.',
        example: { status: 'CLOSED', closeReason: 'SOLD', note: 'Sold to this buyer on Saturday.' },
      },
      responses: [
        { status: 200, description: 'The updated lead.', schema: 'UpdateEnquiryResponse' },
      ],
      errors: [400, 401, 403, 404],
    },
  ],
};
