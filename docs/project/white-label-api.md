# White-label API and consistency policy

Control plane: `/v1/dealer/storefront` plus branding, enabled, publication,
media and preview operations. The existing session resolves the dealership;
OWNER writes and OWNER/MANAGER read. All mutations reauthorize inside the
transaction, serialize website writes per dealer and record an audit event.
STAFF cannot configure a website. Revoked/expired sessions or memberships fail
before commit. The generated OpenAPI reference documents each mounted endpoint.

Public plane: `/v1/storefront/site`, `/cars`, `/cars/:slug` and enquiry-intent
creation. Only the shared storefront server holds `STOREFRONT_SERVICE_SECRET`;
it sends `x-dd-storefront-secret` and the actual request host as
`x-dd-storefront-host`. Forwarded-host and tenant IDs in payloads have no
authority. Normalize at that trusted boundary and fail closed against the
registered domain, current ownership, primary domain, website and dealer state.
Do not forward these credentials into a browser, log or client bundle.

No response is served from a shared data/HTML cache. Public and private website
APIs return `private, no-store`; preview additionally returns `noindex`.
Storefront Next pages must use dynamic rendering and uncached API fetches.
Every public response has an explicit DTO, and every listing predicate fixes
the resolved dealership before filtering/counting. READY owned images only.
No global similar-car API, fallback dealership, cross-tenant vocabulary or
arbitrary external image URL is used.

Listing status remains the existing moderated state machine. Destination
flags are independent: marketplace-only, website-only, both or neither.
ACTIVE appears on selected destinations; RESERVED appears as unavailable and
has no storefront detail/enquiry navigation; SOLD/WITHDRAWN disappear. Direct
detail and enquiry eligibility are checked on the server. The marketplace's
existing publication predicate now additionally checks its destination flag;
the migration's true default preserves every pre-feature record.

Administrative suspension atomically persists ACTIVE/PENDING websites as
SUSPENDED. Dealer reinstatement does not republish them: the owner requests
activation again. Independently, every read also requires an ACTIVE dealer,
so closure or out-of-band approval revocation fails closed. Website disable
retains inventory, enquiries, reservations and domains. Membership removal
revokes that person's control-plane access; the website remains a dealership
asset, governed by dealership approval rather than a person's session.

Branding uploads use existing storage and MIME sniffing with an 8 MiB cap,
16-million-pixel decode cap, animation rejection, metadata stripping and the
existing 320/640/1024/1600 WebP widths. READY is committed only after fresh
authorization. Uploads are private until associated with a live site. Protected
image reads enable draft previews without exposing KYC or publicizing drafts.
Public media delivery rechecks website/publication state before reading bytes;
normal marketplace image delivery remains independent of the feature flag.

Custom domains require ownership verification and a successful check within
24 hours, as well as a verified TLS-ready primary. The shared predicate is used
by reads, submission-time checks and media delivery. Provider onboarding and
renewal scheduling arrive in PR 4; no custom domain is automatically activated
by these endpoints. Default domains require the separate readiness flag, which
the owner sets only after real infrastructure smoke tests.

Enquiries reuse the existing verified-customer sign-in and Enquiry table.
An eligible tenant car produces a signed 30-minute intent and a central
`/website-enquiry` handoff. This is public context, never customer authentication.
The central flow proves the customer's handset through the existing OTP system,
captures explicit disclosure consent and submits to `/v1/enquiries/storefront`.
Server-side intent validation fixes hostname/listing. Submission locks and checks
dealer, website, domain and listing state, uses the existing shared duplicate
guard and inbox/outbox, and records DEALER_WEBSITE, website ID, hostname,
consent timestamp and disclosure version. The caller cannot choose the dealer
or spoof their name/phone. Both origins share customer/IP rate-limit buckets.
Sensitive new writes fail closed when the counter backend is unavailable.

The central enquiry page and storefront presentation arrive in PR 3. Enquiry
disclosure wording still requires qualified legal review and reconciliation
with open PR #279 before production enablement. These endpoints preserve the
existing verified-account safeguards and introduce no anonymous phone form.

Operational failures use the existing RFC 9457 errors, request IDs, pino and
database/HTTP metrics. Unknown/inactive tenants are 404; disabled feature or
unavailable dependencies are service failures, never another tenant's page.
Service credentials and enquiry tickets are redacted. Inventory reads log
duration/count without customer data. The entire feature stays off by default.
