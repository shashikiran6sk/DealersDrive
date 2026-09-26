import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const moderationDocs: ModuleDocs = {
  tag: DOC_TAGS.moderation,
  description:
    'Listing moderation (**F069**, **F070**, as revised by **R45** and **R47**).\n\n' +
    'Dealers submit vehicle data; Dealers-Drive photographs the car, an admin uploads and ' +
    'orders the processed images, verifies the details and decides. Every route here is ' +
    'admin-only and requires `admin:listing:moderate` (MODERATOR, SUPER_ADMIN); a dealer ' +
    'session is refused at the mount, whatever it holds.\n\n' +
    'Every response here is `Cache-Control: no-store`.',
  operations: [
    {
      method: 'get',
      path: '/v1/admin/listings',
      operationId: 'listAdminListings',
      tag: DOC_TAGS.moderation,
      summary: 'The moderation queue',
      description:
        'Listings in one status, `PENDING_REVIEW` when `status` is omitted. The review ' +
        'queue is **oldest submission first**, which is the order it is worked in; every ' +
        'other status is most recently changed first. Cursor-paginated.\n\n' +
        '`q` matches the plate (separators ignored), the make or model, or the dealership. ' +
        '`counts` is per status across the platform and ignores `q`. `resubmission` marks a ' +
        'listing coming back after a request for changes.\n\n' +
        'There is deliberately no approve action on this list (**R45**): a listing cannot be ' +
        'approved until its photographs are uploaded and ordered on the review screen.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      query: 'AdminListingQuery',
      responses: [
        { status: 200, description: 'A page of listings.', schema: 'AdminListingsResponse' },
      ],
      errors: [400, 401, 403, 409],
    },
    {
      method: 'get',
      path: '/v1/admin/listings/:id',
      operationId: 'getAdminListing',
      tag: DOC_TAGS.moderation,
      summary: 'One listing, for review',
      description:
        'Everything a moderator verifies on one screen (**F070**): the dealership, the ' +
        'dealer-entered data in sections (registration, basics, details, pricing), anything ' +
        'still incomplete, the verification checklist, the listing\u2019s decision history ' +
        'from the audit log, and an `actions` block saying which decisions the current state ' +
        'allows. `id` is the listing id.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      params: 'IdParam',
      responses: [{ status: 200, description: 'The listing.', schema: 'AdminListingDetail' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'put',
      path: '/v1/admin/listings/:id/checks/:key',
      operationId: 'setAdminListingCheck',
      tag: DOC_TAGS.moderation,
      summary: 'Tick or untick one verification check',
      description:
        'Records that a moderator verified one thing about the listing — the registration, ' +
        'make and model, variant, year, odometer, ownership or pricing. Idempotent: checking ' +
        'twice is one row, unchecking deletes it.\n\n' +
        'Only while the listing is `PENDING_REVIEW` (`409 LISTING_NOT_REVIEWABLE` otherwise). ' +
        'Every change is audit-logged. The checklist is cleared when the dealer resubmits, ' +
        'and approval requires every key to be checked.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      params: 'ListingCheckParam',
      requestBody: { schema: 'SetListingCheckInput', example: { checked: true } },
      responses: [
        { status: 200, description: 'The listing, as now checked.', schema: 'AdminListingDetail' },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'put',
      path: '/v1/admin/listings/:id/photography',
      operationId: 'setListingPhotography',
      tag: DOC_TAGS.moderation,
      summary: 'Record where the photography has got to',
      description:
        'The operations team\u2019s note of Dealers-Drive\u2019s own shoot (**R45**): not ' +
        'started, scheduled, photographed, processing in StudioCar, or images ready, with an ' +
        'optional internal note. Set by hand \u2014 there is **no StudioCar integration** ' +
        'behind it.\n\n' +
        'While the listing is PENDING_REVIEW or CHANGES_REQUESTED (`409 PHOTOGRAPHY_CLOSED` ' +
        'otherwise). Audit-logged. The note is internal and never reaches a dealer or a buyer. ' +
        'Approval does not read this status; it checks the uploaded images themselves.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      params: 'IdParam',
      requestBody: {
        schema: 'SetPhotographyInput',
        example: { status: 'SCHEDULED', note: 'Shoot booked for Tuesday 10am at the yard.' },
      },
      responses: [{ status: 200, description: 'The listing.', schema: 'AdminListingDetail' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/listings/:id/request-changes',
      operationId: 'requestListingChanges',
      tag: DOC_TAGS.moderation,
      summary: 'Send a listing back to the dealer',
      description:
        'PENDING_REVIEW \u2192 CHANGES_REQUESTED. The reason (6\u2013500 characters) is shown to ' +
        'the dealer verbatim, on the vehicle and in their inventory, and the vehicle becomes ' +
        'editable again. When they resubmit it rejoins the back of the queue with its checklist ' +
        'cleared.\n\n' +
        'Race-safe: two moderators deciding at once get one success and one ' +
        '`409 LISTING_STATE_CHANGED`. Audit-logged with the reason.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      params: 'IdParam',
      requestBody: {
        schema: 'ReasonInput',
        example: { reason: 'The odometer reads 32,400 km, not 22,400 km. Please correct it.' },
      },
      responses: [
        { status: 200, description: 'The listing, sent back.', schema: 'AdminListingDetail' },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'post',
      path: '/v1/admin/listings/:id/reject',
      operationId: 'rejectListing',
      tag: DOC_TAGS.moderation,
      summary: 'Reject a listing',
      description:
        'PENDING_REVIEW \u2192 REJECTED, which is final: there is no way out of REJECTED. The ' +
        'vehicle is **kept**, with the reason, as history — nothing is deleted — and its ' +
        'registration is released, so the car can be entered again if it should be.\n\n' +
        'The reason (6\u2013500 characters) is shown to the dealer verbatim. Race-safe and ' +
        'audit-logged, as above.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      params: 'IdParam',
      requestBody: {
        schema: 'ReasonInput',
        example: { reason: 'This car is already listed by another dealership.' },
      },
      responses: [
        { status: 200, description: 'The listing, rejected.', schema: 'AdminListingDetail' },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
  ],
};
