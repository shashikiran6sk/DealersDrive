import type { ModuleDocs, OperationSpec } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

const management: OperationSpec[] = [
  {
    method: 'get',
    path: '/v1/dealer/storefront/media/:mediaId/:width.webp',
    operationId: 'getStorefrontPreviewImage',
    tag: DOC_TAGS.storefront,
    summary: 'Protected branding preview image',
    description:
      'Session-scoped READY branding media only. Allows draft preview without public delivery. KYC/vehicle/private storage objects and another dealership’s media are refused. No-store and noindex.',
    audience: 'dealer',
    permission: 'storefront:read',
    params: 'StorefrontMediaParam',
    responses: [
      {
        status: 200,
        description: 'Owned branding image.',
        contentType: 'image/webp',
        inlineSchema: { type: 'string', format: 'binary' },
      },
    ],
    errors: [404, 503],
  },
  {
    method: 'get',
    path: '/v1/dealer/storefront',
    operationId: 'getMyStorefront',
    tag: DOC_TAGS.storefront,
    summary: 'Website overview',
    description:
      'Session-derived dealership configuration and feature/infrastructure eligibility. Manager reads; only the owner changes it.',
    audience: 'dealer',
    permission: 'storefront:read',
    responses: [
      { status: 200, description: 'Website overview.', schema: 'StorefrontManagementResponse' },
    ],
  },
  {
    method: 'post',
    path: '/v1/dealer/storefront',
    operationId: 'createMyStorefront',
    tag: DOC_TAGS.storefront,
    summary: 'Reserve your website',
    description:
      'Idempotently reserves a normalized subdomain for the session dealership. Database uniqueness protects concurrent collisions. Starts as DRAFT.',
    audience: 'dealer',
    permission: 'storefront:manage',
    requiresActiveDealer: true,
    requestBody: { schema: 'CreateStorefrontInput', required: true },
    responses: [
      {
        status: 201,
        description: 'Reserved website or same reservation on retry.',
        schema: 'StorefrontManagementResponse',
      },
    ],
    errors: [409, 429, 503],
  },
  {
    method: 'patch',
    path: '/v1/dealer/storefront',
    operationId: 'updateMyStorefront',
    tag: DOC_TAGS.storefront,
    summary: 'Save website branding and theme',
    description:
      'Updates only bounded branding fields and owned READY logo/cover media. Identity/approval stay on the existing dealer record.',
    audience: 'dealer',
    permission: 'storefront:manage',
    requiresActiveDealer: true,
    requestBody: { schema: 'StorefrontBrandingInput', required: true },
    responses: [
      { status: 200, description: 'Saved configuration.', schema: 'StorefrontManagementResponse' },
    ],
    errors: [404, 422, 503],
  },
  {
    method: 'put',
    path: '/v1/dealer/storefront/enabled',
    operationId: 'setMyStorefrontEnabled',
    tag: DOC_TAGS.storefront,
    summary: 'Request activation or disable',
    description:
      'Activation remains pending until infrastructure and a verified primary domain are ready. Never assumes wildcard readiness from a reservation. Disable retains records.',
    audience: 'dealer',
    permission: 'storefront:manage',
    requiresActiveDealer: true,
    requestBody: { schema: 'SetStorefrontEnabledInput', required: true },
    responses: [
      {
        status: 200,
        description: 'Authoritative website status.',
        schema: 'StorefrontManagementResponse',
      },
    ],
    errors: [404, 409, 503],
  },
  {
    method: 'put',
    path: '/v1/dealer/storefront/publication/:id',
    operationId: 'setListingPublication',
    tag: DOC_TAGS.storefront,
    summary: 'Set inventory publication destinations',
    description:
      'Changes destinations for the session dealership listing only. Does not change listing status or bypass moderation.',
    audience: 'dealer',
    permission: 'storefront:manage',
    requiresActiveDealer: true,
    params: 'IdParam',
    requestBody: { schema: 'SetPublicationInput', required: true },
    responses: [{ status: 204, description: 'Destinations saved.' }],
    errors: [404, 503],
  },
  {
    method: 'get',
    path: '/v1/dealer/storefront/preview',
    operationId: 'previewMyStorefront',
    tag: DOC_TAGS.storefront,
    summary: 'Protected website preview',
    description:
      'Authenticated, no-store, noindex preview of branding and this dealership’s approved inventory only. Never publishes drafts.',
    audience: 'dealer',
    permission: 'storefront:read',
    responses: [
      { status: 200, description: 'Authorized preview.', schema: 'StorefrontPreviewResponse' },
    ],
    errors: [404],
  },
  {
    method: 'post',
    path: '/v1/dealer/storefront/media/presign',
    operationId: 'presignStorefrontBranding',
    tag: DOC_TAGS.storefront,
    summary: 'Upload a branding image',
    description:
      'Owner-only size/MIME-bounded upload using existing object storage. Image remains private until processed and associated with an active website.',
    audience: 'dealer',
    permission: 'storefront:manage',
    requiresActiveDealer: true,
    requestBody: { schema: 'StorefrontMediaPresignInput', required: true },
    responses: [{ status: 200, description: 'Short-lived upload.', schema: 'PresignResponse' }],
    errors: [404, 429, 503],
  },
  {
    method: 'post',
    path: '/v1/dealer/storefront/media/commit',
    operationId: 'commitStorefrontBranding',
    tag: DOC_TAGS.storefront,
    summary: 'Process a branding image',
    description:
      'Checks actual bytes/MIME, rejects animated/oversized pixel input, strips metadata and writes bounded WebP derivatives. Reauthorizes before READY. Retry is idempotent.',
    audience: 'dealer',
    permission: 'storefront:manage',
    requiresActiveDealer: true,
    requestBody: { schema: 'StorefrontMediaCommitInput', required: true },
    responses: [
      { status: 200, description: 'Processed owned image.', schema: 'StorefrontMediaReceipt' },
    ],
    errors: [404, 422, 429, 503],
  },
];

const publicOperations: OperationSpec[] = [
  {
    method: 'get',
    path: '/v1/storefront/sitemap',
    operationId: 'getStorefrontSitemap',
    tag: DOC_TAGS.storefront,
    summary: 'Tenant sitemap entries',
    description:
      'Trusted-host, 1,000-entry pages of only this dealership’s ACTIVE website-published cars, with current inventory timestamps and total pages. No-store, same domain/website visibility as ordinary public reads.',
    audience: 'internal',
    query: 'StorefrontSitemapQuery',
    responses: [
      { status: 200, description: 'Tenant sitemap page.', schema: 'StorefrontSitemapResponse' },
    ],
    errors: [401, 404, 429, 503],
  },
  {
    method: 'get',
    path: '/v1/storefront/site',
    operationId: 'resolvePublicStorefront',
    tag: DOC_TAGS.storefront,
    summary: 'Resolve a trusted website hostname',
    description:
      'Requires server-only x-dd-storefront-secret and x-dd-storefront-host. Ignores forwarded-host. Only verified, current domains on ACTIVE websites/dealers resolve. Explicit public DTO; no-store.',
    audience: 'internal',
    responses: [{ status: 200, description: 'Public branding.', schema: 'PublicStorefrontDto' }],
    errors: [400, 401, 404, 429, 503],
  },
  {
    method: 'get',
    path: '/v1/storefront/cars',
    operationId: 'listStorefrontCars',
    tag: DOC_TAGS.storefront,
    summary: 'Tenant inventory',
    description:
      'Trusted hostname resolves the dealership; all filters, counts and results are scoped to its approved ACTIVE/RESERVED website-published inventory. Reserved cards cannot be enquired on.',
    audience: 'internal',
    query: 'StorefrontInventoryQuery',
    responses: [
      {
        status: 200,
        description: 'Bounded inventory page.',
        schema: 'StorefrontInventoryResponse',
      },
    ],
    errors: [401, 404, 429, 503],
  },
  {
    method: 'get',
    path: '/v1/storefront/cars/:slug',
    operationId: 'getStorefrontCar',
    tag: DOC_TAGS.storefront,
    summary: 'Tenant vehicle detail',
    description:
      'Trusted verified hostname plus tenant predicate. Only ACTIVE approved website-published cars and READY owned media; other dealers, sold, withdrawn and reserved cars are 404.',
    audience: 'internal',
    params: 'VehicleSlugParam',
    responses: [
      { status: 200, description: 'Public vehicle.', schema: 'StorefrontVehicleResponse' },
    ],
    errors: [401, 404, 429, 503],
  },
  {
    method: 'post',
    path: '/v1/storefront/enquiry-intent',
    operationId: 'createStorefrontIntent',
    tag: DOC_TAGS.storefront,
    summary: 'Start a verified-customer enquiry',
    description:
      'Trusted host and eligible car produce a signed 30-minute intent and central customer flow URL. No cross-domain dashboard cookies or client-supplied dealer identity.',
    audience: 'internal',
    requestBody: { schema: 'StorefrontIntentInput', required: true },
    responses: [
      {
        status: 200,
        description: 'Verified-customer handoff URL.',
        schema: 'StorefrontIntentResponse',
      },
    ],
    errors: [401, 404, 429, 503],
  },
  {
    method: 'get',
    path: '/v1/storefront/enquiry-intent/:ticket',
    operationId: 'getStorefrontIntent',
    tag: DOC_TAGS.storefront,
    summary: 'Read signed enquiry context',
    description:
      'Checks signature, expiry and current website/car eligibility. Returns only public names and a registered-domain return URL. Does not authenticate the customer.',
    audience: 'public',
    params: 'StorefrontIntentParam',
    responses: [
      { status: 200, description: 'Enquiry context.', schema: 'StorefrontEnquiryContext' },
    ],
    errors: [401, 404, 429, 503],
  },
];

export const storefrontDocs: ModuleDocs = {
  tag: DOC_TAGS.storefront,
  description:
    'Shared dealership websites: authenticated control plane and trusted-host, isolated public read plane. Enabled explicitly by server flags; existing marketplace remains independent.',
  operations: [...management, ...publicOperations],
};
