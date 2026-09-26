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
  ],
};
