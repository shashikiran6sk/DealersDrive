# V1 feature inventory — internal review

Audit date: 8 October 2026. Baseline: `2a1845abcab9a6cf8b9fc3658cb5c92bf3c92566`. Local `origin/main` was stale; the clean feature branch was fast-forwarded to the owner-specified commit, independently confirmed with the connected GitHub tool. Shell fetch/pull failed because the configured proxy was unreachable. No production data or secrets were inspected.

Read-only audit covered the schema/migrations, mounted route aggregators and guards, service/repository/mapper paths, public/auth/dealer/admin/sales routes, server actions, provider adapters, config, deployment definitions and existing test harness/CI. Historical plans were treated as plans. The endpoint index below records all mounted-route source declarations. Presence in code does not prove a feature is enabled in production; production flags and provider accounts require BUSINESS CONFIRMATION REQUIRED.

| Feature                     | Baseline finding (CONFIRMED IN CODE except stated)                                                                                                                                                                                                                                                                  | Evidence                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Public marketplace          | Homepage, filters, distance/location sorting, vehicle detail, available/reserved/sold cards; public dealer directory and portfolios; no registration required.                                                                                                                                                      | [apps/api/src/modules/search/search.service.ts:91](../../apps/api/src/modules/search/search.service.ts#L91)                                 |
| Customer identity           | Phone OTP, name registration, opaque cookie sessions. Customer Google signup is NOT IMPLEMENTED; Google is dealer/admin sign-in and dealer account linking. A dealer with a proved phone/name may use customer features.                                                                                            | [apps/api/src/modules/auth/customer-auth.service.ts:102](../../apps/api/src/modules/auth/customer-auth.service.ts#L102)                     |
| Saved vehicles              | Account-backed shortlist; private, persists on sold/withdrawn listings.                                                                                                                                                                                                                                             | [apps/api/src/modules/saved-vehicles/saved-vehicles.service.ts:25](../../apps/api/src/modules/saved-vehicles/saved-vehicles.service.ts#L25) |
| Enquiries                   | Signed-in customer only, including OTP sign-in from enquiry panel. No anonymous guest enquiry endpoint. Shares customer full name, proved phone and optional message with relevant dealership; duplicate open enquiry refused under advisory lock.                                                                  | [apps/api/src/modules/enquiries/enquiries.service.ts:242](../../apps/api/src/modules/enquiries/enquiries.service.ts#L242)                   |
| Support/complaints          | Customer tickets with categories, messages, private internal notes, assignment/status controls. Email/telephone/WhatsApp support links. No mandatory agreement obstacle for support.                                                                                                                                | [apps/api/src/modules/support/support.service.ts:85](../../apps/api/src/modules/support/support.service.ts#L85)                             |
| Dealer identity/onboarding  | Google and phone linking; verified phone required, business name/address/maps/contact, GST/PAN IDs and GST certificate/PAN/address-proof uploads; yard photo, draft, submission, changes requested, approval, rejection, suspension and closure. Legal entity type and signatory authority not established by code. | [apps/api/src/modules/auth/auth.service.ts:267](../../apps/api/src/modules/auth/auth.service.ts#L267)                                       |
| Dealer documents            | Private signed read URLs, tenant checks, authorized document review. Documents can be replaced/deleted subject to lifecycle; replacement removes prior storage object.                                                                                                                                              | [apps/api/src/modules/dealers/dealers.service.ts:666](../../apps/api/src/modules/dealers/dealers.service.ts#L666)                           |
| Dealer review               | Authorized admin document statuses and dealership decisions; no integrated government-record check provider found. Public verification wording needs owner substantiation.                                                                                                                                          | [apps/api/src/modules/admin/admin.service.ts:125](../../apps/api/src/modules/admin/admin.service.ts#L125)                                   |
| Inventory                   | Manual registration and vehicle details, price in paise, draft autosaves; final submit/resubmit, reserved, sold, withdrawal and admin-controlled relisting/reactivation. No checkout, payment, credit purchase or commission implementation. Credit fields/features are scaffolding.                                | [apps/api/src/modules/vehicles/vehicles.service.ts:356](../../apps/api/src/modules/vehicles/vehicles.service.ts#L356)                       |
| Photography/moderation      | Admin photography status, file uploads, resizing/encoding/blurhash, required minimum images and moderation checks. Review is not mechanical inspection or certification. External AI image processing is NOT IMPLEMENTED.                                                                                           | [apps/api/src/modules/moderation/moderation.service.ts:185](../../apps/api/src/modules/moderation/moderation.service.ts#L185)               |
| Staff/team                  | OWNER/MANAGER/STAFF per-dealership membership, phone invitations; multi-dealership workspace choice, transactional write reauthorization. Permission to submit does not prove power to bind dealer contract.                                                                                                        | [apps/api/src/modules/auth/dealer-write-authorization.ts:23](../../apps/api/src/modules/auth/dealer-write-authorization.ts#L23)             |
| Operations                  | SUPPORT/MODERATOR/SUPER_ADMIN and separate SALES_REP, invitation/activation/disable history; permissions re-read. Enquiry administration, support, notifications, config. No general personal-data export discovered.                                                                                               | [apps/api/src/modules/admin-members/admin-members.service.ts:93](../../apps/api/src/modules/admin-members/admin-members.service.ts#L93)     |
| Assisted sales              | Representative verifies dealership handset, creates draft and uploads documents, requests verified email/ownership claim, prepares vehicle drafts and submits; self-review forbidden. Sharing OTP is not legal Terms acceptance.                                                                                    | [apps/api/src/modules/sales/sales.service.ts:422](../../apps/api/src/modules/sales/sales.service.ts#L422)                                   |
| Account linking             | Prove both identities before merging, preserve absorbed DELETED user row and merge audit. No customer self-service account erasure.                                                                                                                                                                                 | [apps/api/src/modules/auth/account-merge.ts:95](../../apps/api/src/modules/auth/account-merge.ts#L95)                                       |
| Notifications               | Transactional outbox, pg-boss, verified-address Resend emails; enquiry email uses first name/message but omits phone/surname; support email omits description. No implemented marketing campaign/subscription or SMS acknowledgement.                                                                               | [apps/api/src/modules/notifications/notifications.service.ts:54](../../apps/api/src/modules/notifications/notifications.service.ts#L54)     |
| Configuration/observability | Public support/social/features config; admin config writes; IP rate limits, security headers, redacted application logs, metrics, optional Grafana Loki; no analytics/cookie ad tracking discovered.                                                                                                                | [apps/api/src/platform/telemetry/logger.ts:8](../../apps/api/src/platform/telemetry/logger.ts#L8)                                           |

## Explicit exclusions and uncertainties

- FUTURE V2 ONLY: independent condition inspection, multi-point checks and inspection certificates.
- NOT IMPLEMENTED: customer Google signup, password login, guest enquiry without authenticated OTP, customer account erasure UI, payments, subscriptions, commissions, active marketing preference/campaign, RC provider lookup, external AI image service, consent/version registry at baseline.
- BUSINESS CONFIRMATION REQUIRED: legal entity/type, full address, grievance appointment, signatory authority, vendor regions/contracts/retention, government-record dealer checks, actual deployment flags.
- LEGAL REVIEW REQUIRED: marketplace e-commerce and intermediary classification, children, retention/legal holds, dispute/indemnity clauses.

## Endpoint declaration index

This is a route-source inventory; full mounted prefixes and permissions are defined in `apps/api/src/routes.ts` and module aggregators.

- [apps/api/src/modules/admin/routes/delete-access.ts:9](../../apps/api/src/modules/admin/routes/delete-access.ts#L9) — router.delete(
- [apps/api/src/modules/admin/routes/get-access.ts:6](../../apps/api/src/modules/admin/routes/get-access.ts#L6) — router.get(
- [apps/api/src/modules/admin/routes/get-config.ts:6](../../apps/api/src/modules/admin/routes/get-config.ts#L6) — router.get(
- [apps/api/src/modules/admin/routes/get-dealer.ts:9](../../apps/api/src/modules/admin/routes/get-dealer.ts#L9) — router.get(
- [apps/api/src/modules/admin/routes/get-dealers.ts:11](../../apps/api/src/modules/admin/routes/get-dealers.ts#L11) — router.get(
- [apps/api/src/modules/admin/routes/get-metrics-overview.ts:6](../../apps/api/src/modules/admin/routes/get-metrics-overview.ts#L6) — router.get(
- [apps/api/src/modules/admin/routes/get-profile-changes.ts:6](../../apps/api/src/modules/admin/routes/get-profile-changes.ts#L6) — router.get(
- [apps/api/src/modules/admin/routes/patch-dealer.ts:14](../../apps/api/src/modules/admin/routes/patch-dealer.ts#L14) — router.patch(
- [apps/api/src/modules/admin/routes/post-access.ts:12](../../apps/api/src/modules/admin/routes/post-access.ts#L12) — router.post(
- [apps/api/src/modules/admin/routes/post-dealer-approve.ts:14](../../apps/api/src/modules/admin/routes/post-dealer-approve.ts#L14) — router.post(
- [apps/api/src/modules/admin/routes/post-dealer-close.ts:14](../../apps/api/src/modules/admin/routes/post-dealer-close.ts#L14) — router.post(
- [apps/api/src/modules/admin/routes/post-dealer-reinstate.ts:14](../../apps/api/src/modules/admin/routes/post-dealer-reinstate.ts#L14) — router.post(
- [apps/api/src/modules/admin/routes/post-dealer-reject.ts:14](../../apps/api/src/modules/admin/routes/post-dealer-reject.ts#L14) — router.post(
- [apps/api/src/modules/admin/routes/post-dealer-request-changes.ts:14](../../apps/api/src/modules/admin/routes/post-dealer-request-changes.ts#L14) — router.post(
- [apps/api/src/modules/admin/routes/post-dealer-suspend.ts:14](../../apps/api/src/modules/admin/routes/post-dealer-suspend.ts#L14) — router.post(
- [apps/api/src/modules/admin/routes/post-document-reject.ts:14](../../apps/api/src/modules/admin/routes/post-document-reject.ts#L14) — router.post(
- [apps/api/src/modules/admin/routes/post-document-verify.ts:9](../../apps/api/src/modules/admin/routes/post-document-verify.ts#L9) — router.post(
- [apps/api/src/modules/admin/routes/post-profile-change-approve.ts:9](../../apps/api/src/modules/admin/routes/post-profile-change-approve.ts#L9) — router.post(
- [apps/api/src/modules/admin/routes/post-profile-change-reject.ts:14](../../apps/api/src/modules/admin/routes/post-profile-change-reject.ts#L14) — router.post(
- [apps/api/src/modules/admin/routes/put-config-key.ts:14](../../apps/api/src/modules/admin/routes/put-config-key.ts#L14) — router.put(
- [apps/api/src/modules/admin-members/routes/post-member-activate.ts:9](../../apps/api/src/modules/admin-members/routes/post-member-activate.ts#L9) — router.post(
- [apps/api/src/modules/admin-members/routes/post-member.ts:9](../../apps/api/src/modules/admin-members/routes/post-member.ts#L9) — router.post(
- [apps/api/src/modules/admin-members/routes/get-members.ts:9](../../apps/api/src/modules/admin-members/routes/get-members.ts#L9) — router.get(
- [apps/api/src/modules/admin-members/routes/patch-member.ts:9](../../apps/api/src/modules/admin-members/routes/patch-member.ts#L9) — router.patch(
- [apps/api/src/modules/admin-members/routes/get-member-history.ts:9](../../apps/api/src/modules/admin-members/routes/get-member-history.ts#L9) — router.get(
- [apps/api/src/modules/admin-members/routes/post-member-disable.ts:9](../../apps/api/src/modules/admin-members/routes/post-member-disable.ts#L9) — router.post(
- [apps/api/src/modules/auth/routes/get-admin-google-start.ts:5](../../apps/api/src/modules/auth/routes/get-admin-google-start.ts#L5) — router.get('/admin/google/start', startGoogle(service, 'ADMIN'));
- [apps/api/src/modules/auth/routes/get-customer-me.ts:6](../../apps/api/src/modules/auth/routes/get-customer-me.ts#L6) — router.get('/me', (req, res, next) => {
- [apps/api/src/modules/auth/routes/get-google-callback.ts:15](../../apps/api/src/modules/auth/routes/get-google-callback.ts#L15) — router.get('/google/callback', (req, res, next) => {
- [apps/api/src/modules/auth/routes/get-google-link-start.ts:7](../../apps/api/src/modules/auth/routes/get-google-link-start.ts#L7) — router.get('/google/link/start', (req, res, next) => {
- [apps/api/src/modules/auth/routes/get-google-start.ts:5](../../apps/api/src/modules/auth/routes/get-google-start.ts#L5) — router.get('/google/start', startGoogle(service, 'DEALER'));
- [apps/api/src/modules/auth/routes/get-me.ts:6](../../apps/api/src/modules/auth/routes/get-me.ts#L6) — router.get('/me', (req, res, next) => {
- [apps/api/src/modules/auth/routes/get-phone-widget.ts:5](../../apps/api/src/modules/auth/routes/get-phone-widget.ts#L5) — router.get(
- [apps/api/src/modules/auth/routes/get-providers.ts:4](../../apps/api/src/modules/auth/routes/get-providers.ts#L4) — router.get('/providers', (_req, res) => {
- [apps/api/src/modules/auth/routes/get-sign-in-phone-widget.ts:5](../../apps/api/src/modules/auth/routes/get-sign-in-phone-widget.ts#L5) — router.get(
- [apps/api/src/modules/auth/routes/get-workspaces.ts:7](../../apps/api/src/modules/auth/routes/get-workspaces.ts#L7) — router.get('/', (req, res, next) => {
- [apps/api/src/modules/auth/routes/post-admin-logout.ts:6](../../apps/api/src/modules/auth/routes/post-admin-logout.ts#L6) — router.post('/admin/logout', (req, res, next) => {
- [apps/api/src/modules/auth/routes/post-customer-logout.ts:6](../../apps/api/src/modules/auth/routes/post-customer-logout.ts#L6) — router.post('/customer/logout', (req, res, next) => {
- [apps/api/src/modules/auth/routes/post-logout.ts:7](../../apps/api/src/modules/auth/routes/post-logout.ts#L7) — router.post('/logout', (req, res, next) => {
- [apps/api/src/modules/auth/routes/post-onboarding.ts:10](../../apps/api/src/modules/auth/routes/post-onboarding.ts#L10) — router.post('/onboarding', validate({ body: OnboardingInput }), (req, res, next) => {
- [apps/api/src/modules/auth/routes/post-phone-availability.ts:10](../../apps/api/src/modules/auth/routes/post-phone-availability.ts#L10) — router.post(
- [apps/api/src/modules/auth/routes/post-phone-verify.ts:11](../../apps/api/src/modules/auth/routes/post-phone-verify.ts#L11) — router.post(
- [apps/api/src/modules/auth/routes/post-sign-in-phone-customer.ts:10](../../apps/api/src/modules/auth/routes/post-sign-in-phone-customer.ts#L10) — router.post(
- [apps/api/src/modules/auth/routes/post-sign-in-phone-dealer.ts:10](../../apps/api/src/modules/auth/routes/post-sign-in-phone-dealer.ts#L10) — router.post(
- [apps/api/src/modules/auth/routes/post-sign-up-customer.ts:10](../../apps/api/src/modules/auth/routes/post-sign-up-customer.ts#L10) — router.post(
- [apps/api/src/modules/auth/routes/put-workspace.ts:10](../../apps/api/src/modules/auth/routes/put-workspace.ts#L10) — router.put('/current', validate({ body: SelectWorkspaceInput }), (req, res, next) => {
- [apps/api/src/modules/config/routes/get-config-public.ts:4](../../apps/api/src/modules/config/routes/get-config-public.ts#L4) — router.get('/config/public', (_req, res, next) => {
- [apps/api/src/modules/dealer-claims/routes/get-claim.ts:9](../../apps/api/src/modules/dealer-claims/routes/get-claim.ts#L9) — router.get(
- [apps/api/src/modules/dealer-claims/routes/post-claim-verify-email.ts:9](../../apps/api/src/modules/dealer-claims/routes/post-claim-verify-email.ts#L9) — router.post(
- [apps/api/src/modules/dealer-claims/routes/post-claim.ts:14](../../apps/api/src/modules/dealer-claims/routes/post-claim.ts#L14) — router.post(
- [apps/api/src/modules/dealers/routes/delete-document.ts:9](../../apps/api/src/modules/dealers/routes/delete-document.ts#L9) — router.delete(
- [apps/api/src/modules/dealers/routes/delete-profile-change.ts:6](../../apps/api/src/modules/dealers/routes/delete-profile-change.ts#L6) — router.delete('/profile-change', requirePermission('dealer:update'), (req, res, next) => {
- [apps/api/src/modules/dealers/routes/delete-yard-photo.ts:6](../../apps/api/src/modules/dealers/routes/delete-yard-photo.ts#L6) — router.delete('/yard-photo', requirePermission('document:upload'), (req, res, next) => {
- [apps/api/src/modules/dealers/routes/get-completeness.ts:6](../../apps/api/src/modules/dealers/routes/get-completeness.ts#L6) — router.get('/completeness', (req, res, next) => {
- [apps/api/src/modules/dealers/routes/get-dashboard.ts:6](../../apps/api/src/modules/dealers/routes/get-dashboard.ts#L6) — router.get('/dashboard', (req, res, next) => {
- [apps/api/src/modules/dealers/routes/get-documents.ts:6](../../apps/api/src/modules/dealers/routes/get-documents.ts#L6) — router.get('/documents', requirePermission('document:upload'), (req, res, next) => {
- [apps/api/src/modules/dealers/routes/get-profile.ts:6](../../apps/api/src/modules/dealers/routes/get-profile.ts#L6) — router.get('/', (req, res, next) => {
- [apps/api/src/modules/dealers/routes/get-yard-photo.ts:6](../../apps/api/src/modules/dealers/routes/get-yard-photo.ts#L6) — router.get('/yard-photo', (req, res, next) => {
- [apps/api/src/modules/dealers/routes/patch-onboarding.ts:12](../../apps/api/src/modules/dealers/routes/patch-onboarding.ts#L12) — router.patch(
- [apps/api/src/modules/dealers/routes/patch-profile.ts:12](../../apps/api/src/modules/dealers/routes/patch-profile.ts#L12) — router.patch(
- [apps/api/src/modules/dealers/routes/post-document-commit.ts:14](../../apps/api/src/modules/dealers/routes/post-document-commit.ts#L14) — router.post(
- [apps/api/src/modules/dealers/routes/post-document-presign.ts:12](../../apps/api/src/modules/dealers/routes/post-document-presign.ts#L12) — router.post(
- [apps/api/src/modules/dealers/routes/post-submit.ts:6](../../apps/api/src/modules/dealers/routes/post-submit.ts#L6) — router.post('/submit', requirePermission('dealer:update'), (req, res, next) => {
- [apps/api/src/modules/dealers/routes/post-yard-photo-commit.ts:12](../../apps/api/src/modules/dealers/routes/post-yard-photo-commit.ts#L12) — router.post(
- [apps/api/src/modules/dealers/routes/post-yard-photo-presign.ts:12](../../apps/api/src/modules/dealers/routes/post-yard-photo-presign.ts#L12) — router.post(
- [apps/api/src/modules/enquiries/routes/get-admin-enquiries.ts:10](../../apps/api/src/modules/enquiries/routes/get-admin-enquiries.ts#L10) — router.get(
- [apps/api/src/modules/enquiries/routes/get-admin-enquiry.ts:10](../../apps/api/src/modules/enquiries/routes/get-admin-enquiry.ts#L10) — router.get(
- [apps/api/src/modules/enquiries/routes/get-dealer-enquiries.ts:10](../../apps/api/src/modules/enquiries/routes/get-dealer-enquiries.ts#L10) — router.get(
- [apps/api/src/modules/enquiries/routes/get-dealer-enquiry-counts.ts:7](../../apps/api/src/modules/enquiries/routes/get-dealer-enquiry-counts.ts#L7) — router.get(
- [apps/api/src/modules/enquiries/routes/get-my-enquiries.ts:10](../../apps/api/src/modules/enquiries/routes/get-my-enquiries.ts#L10) — router.get(
- [apps/api/src/modules/enquiries/routes/patch-dealer-enquiry.ts:10](../../apps/api/src/modules/enquiries/routes/patch-dealer-enquiry.ts#L10) — router.patch(
- [apps/api/src/modules/enquiries/routes/post-enquiry.ts:11](../../apps/api/src/modules/enquiries/routes/post-enquiry.ts#L11) — router.post(
- [apps/api/src/modules/health/routes/get-live.ts:4](../../apps/api/src/modules/health/routes/get-live.ts#L4) — router.get('/live', (_req, res) => {
- [apps/api/src/modules/health/routes/get-ready.ts:10](../../apps/api/src/modules/health/routes/get-ready.ts#L10) — router.get('/ready', (_req, res, next) => {
- [apps/api/src/modules/media/routes/get-media-image.ts:8](../../apps/api/src/modules/media/routes/get-media-image.ts#L8) — router.get('/media/by-media/:mediaId/:width.webp', (req, res, next) => {
- [apps/api/src/modules/media/routes/get-private.ts:17](../../apps/api/src/modules/media/routes/get-private.ts#L17) — router.get('/private', validate({ query: PrivateReadQuery }), (req, res, next) => {
- [apps/api/src/modules/media/routes/put-uploads.ts:12](../../apps/api/src/modules/media/routes/put-uploads.ts#L12) — router.put(
- [apps/api/src/modules/moderation/routes/get-listing.ts:9](../../apps/api/src/modules/moderation/routes/get-listing.ts#L9) — router.get(
- [apps/api/src/modules/moderation/routes/get-listings.ts:12](../../apps/api/src/modules/moderation/routes/get-listings.ts#L12) — router.get(
- [apps/api/src/modules/moderation/routes/get-reactivation-requests.ts:12](../../apps/api/src/modules/moderation/routes/get-reactivation-requests.ts#L12) — router.get(
- [apps/api/src/modules/moderation/routes/post-listing-approve.ts:9](../../apps/api/src/modules/moderation/routes/post-listing-approve.ts#L9) — router.post(
- [apps/api/src/modules/moderation/routes/post-listing-reject.ts:14](../../apps/api/src/modules/moderation/routes/post-listing-reject.ts#L14) — router.post(
- [apps/api/src/modules/moderation/routes/post-listing-request-changes.ts:14](../../apps/api/src/modules/moderation/routes/post-listing-request-changes.ts#L14) — router.post(
- [apps/api/src/modules/moderation/routes/post-reactivation-request-approve.ts:14](../../apps/api/src/modules/moderation/routes/post-reactivation-request-approve.ts#L14) — router.post(
- [apps/api/src/modules/moderation/routes/post-reactivation-request-reject.ts:14](../../apps/api/src/modules/moderation/routes/post-reactivation-request-reject.ts#L14) — router.post(
- [apps/api/src/modules/moderation/routes/put-listing-check.ts:14](../../apps/api/src/modules/moderation/routes/put-listing-check.ts#L14) — router.put(
- [apps/api/src/modules/moderation/routes/put-listing-photography.ts:14](../../apps/api/src/modules/moderation/routes/put-listing-photography.ts#L14) — router.put(
- [apps/api/src/modules/notifications/routes/get-admin-notifications.ts:9](../../apps/api/src/modules/notifications/routes/get-admin-notifications.ts#L9) — router.get(
- [apps/api/src/modules/sales/routes/patch-dealer-vehicle.ts:9](../../apps/api/src/modules/sales/routes/patch-dealer-vehicle.ts#L9) — router.patch(
- [apps/api/src/modules/sales/routes/post-phone-verify.ts:10](../../apps/api/src/modules/sales/routes/post-phone-verify.ts#L10) — router.post(
- [apps/api/src/modules/sales/routes/post-dealer-submit.ts:9](../../apps/api/src/modules/sales/routes/post-dealer-submit.ts#L9) — router.post(
- [apps/api/src/modules/sales/routes/post-dealer-vehicle-submit.ts:9](../../apps/api/src/modules/sales/routes/post-dealer-vehicle-submit.ts#L9) — router.post(
- [apps/api/src/modules/sales/routes/patch-dealer.ts:9](../../apps/api/src/modules/sales/routes/patch-dealer.ts#L9) — router.patch(
- [apps/api/src/modules/sales/routes/post-dealer-yard-photo-presign.ts:9](../../apps/api/src/modules/sales/routes/post-dealer-yard-photo-presign.ts#L9) — router.post(
- [apps/api/src/modules/sales/routes/post-dealer-document-presign.ts:9](../../apps/api/src/modules/sales/routes/post-dealer-document-presign.ts#L9) — router.post(
- [apps/api/src/modules/sales/routes/get-dealer-vehicles.ts:9](../../apps/api/src/modules/sales/routes/get-dealer-vehicles.ts#L9) — router.get(
- [apps/api/src/modules/sales/routes/get-dealer-vehicle.ts:9](../../apps/api/src/modules/sales/routes/get-dealer-vehicle.ts#L9) — router.get(
- [apps/api/src/modules/sales/routes/post-dealer-email-verification.ts:9](../../apps/api/src/modules/sales/routes/post-dealer-email-verification.ts#L9) — router.post(
- [apps/api/src/modules/sales/routes/post-dealer-vehicle.ts:9](../../apps/api/src/modules/sales/routes/post-dealer-vehicle.ts#L9) — router.post(
- [apps/api/src/modules/sales/routes/post-dealer.ts:9](../../apps/api/src/modules/sales/routes/post-dealer.ts#L9) — router.post(
- [apps/api/src/modules/sales/routes/post-dealer-document-commit.ts:9](../../apps/api/src/modules/sales/routes/post-dealer-document-commit.ts#L9) — router.post(
- [apps/api/src/modules/sales/routes/get-dealers.ts:9](../../apps/api/src/modules/sales/routes/get-dealers.ts#L9) — router.get(
- [apps/api/src/modules/sales/routes/get-dealer.ts:9](../../apps/api/src/modules/sales/routes/get-dealer.ts#L9) — router.get(
- [apps/api/src/modules/sales/routes/post-dealer-yard-photo-commit.ts:9](../../apps/api/src/modules/sales/routes/post-dealer-yard-photo-commit.ts#L9) — router.post(
- [apps/api/src/modules/sales/routes/get-dashboard.ts:6](../../apps/api/src/modules/sales/routes/get-dashboard.ts#L6) — router.get(
- [apps/api/src/modules/sales/routes/delete-dealer-yard-photo.ts:9](../../apps/api/src/modules/sales/routes/delete-dealer-yard-photo.ts#L9) — router.delete(
- [apps/api/src/modules/sales/routes/get-phone-widget.ts:6](../../apps/api/src/modules/sales/routes/get-phone-widget.ts#L6) — router.get(
- [apps/api/src/modules/sales/routes/delete-dealer-document.ts:9](../../apps/api/src/modules/sales/routes/delete-dealer-document.ts#L9) — router.delete(
- [apps/api/src/modules/saved-vehicles/routes/delete-saved-vehicle.ts:14](../../apps/api/src/modules/saved-vehicles/routes/delete-saved-vehicle.ts#L14) — router.delete(
- [apps/api/src/modules/saved-vehicles/routes/get-saved-slugs.ts:7](../../apps/api/src/modules/saved-vehicles/routes/get-saved-slugs.ts#L7) — router.get(
- [apps/api/src/modules/saved-vehicles/routes/get-saved-vehicles.ts:10](../../apps/api/src/modules/saved-vehicles/routes/get-saved-vehicles.ts#L10) — router.get(
- [apps/api/src/modules/saved-vehicles/routes/put-saved-vehicle.ts:14](../../apps/api/src/modules/saved-vehicles/routes/put-saved-vehicle.ts#L14) — router.put(
- [apps/api/src/modules/search/routes/get-dealer-vehicles.ts:13](../../apps/api/src/modules/search/routes/get-dealer-vehicles.ts#L13) — router.get(
- [apps/api/src/modules/search/routes/get-search-vehicles.ts:11](../../apps/api/src/modules/search/routes/get-search-vehicles.ts#L11) — router.get(
- [apps/api/src/modules/search/routes/get-sitemap.ts:8](../../apps/api/src/modules/search/routes/get-sitemap.ts#L8) — router.get('/sitemap', publicReads, validate({ query: SitemapQuery }), (_req, res, next) => {
- [apps/api/src/modules/search/routes/get-vehicle-similar.ts:11](../../apps/api/src/modules/search/routes/get-vehicle-similar.ts#L11) — router.get(
- [apps/api/src/modules/search/routes/get-vehicle.ts:11](../../apps/api/src/modules/search/routes/get-vehicle.ts#L11) — router.get(
- [apps/api/src/modules/search/routes/get-vehicles.ts:11](../../apps/api/src/modules/search/routes/get-vehicles.ts#L11) — router.get(
- [apps/api/src/modules/support/routes/get-admin-ticket.ts:10](../../apps/api/src/modules/support/routes/get-admin-ticket.ts#L10) — router.get(
- [apps/api/src/modules/support/routes/get-admin-tickets.ts:10](../../apps/api/src/modules/support/routes/get-admin-tickets.ts#L10) — router.get(
- [apps/api/src/modules/support/routes/get-my-ticket.ts:10](../../apps/api/src/modules/support/routes/get-my-ticket.ts#L10) — router.get(
- [apps/api/src/modules/support/routes/get-my-tickets.ts:10](../../apps/api/src/modules/support/routes/get-my-tickets.ts#L10) — router.get(
- [apps/api/src/modules/support/routes/patch-admin-ticket.ts:10](../../apps/api/src/modules/support/routes/patch-admin-ticket.ts#L10) — router.patch(
- [apps/api/src/modules/support/routes/post-admin-ticket-message.ts:10](../../apps/api/src/modules/support/routes/post-admin-ticket-message.ts#L10) — router.post(
- [apps/api/src/modules/support/routes/post-admin-ticket-note.ts:10](../../apps/api/src/modules/support/routes/post-admin-ticket-note.ts#L10) — router.post(
- [apps/api/src/modules/support/routes/post-ticket-message.ts:12](../../apps/api/src/modules/support/routes/post-ticket-message.ts#L12) — router.post(
- [apps/api/src/modules/support/routes/post-ticket.ts:12](../../apps/api/src/modules/support/routes/post-ticket.ts#L12) — router.post(
- [apps/api/src/modules/team/routes/delete-team-invitation.ts:11](../../apps/api/src/modules/team/routes/delete-team-invitation.ts#L11) — router.delete(
- [apps/api/src/modules/team/routes/delete-team-member.ts:11](../../apps/api/src/modules/team/routes/delete-team-member.ts#L11) — router.delete(
- [apps/api/src/modules/team/routes/get-my-invitations.ts:7](../../apps/api/src/modules/team/routes/get-my-invitations.ts#L7) — router.get(
- [apps/api/src/modules/team/routes/get-team.ts:8](../../apps/api/src/modules/team/routes/get-team.ts#L8) — router.get(
- [apps/api/src/modules/team/routes/patch-team-member.ts:11](../../apps/api/src/modules/team/routes/patch-team-member.ts#L11) — router.patch(
- [apps/api/src/modules/team/routes/post-invitation-accept.ts:10](../../apps/api/src/modules/team/routes/post-invitation-accept.ts#L10) — router.post(
- [apps/api/src/modules/team/routes/post-invitation-decline.ts:10](../../apps/api/src/modules/team/routes/post-invitation-decline.ts#L10) — router.post(
- [apps/api/src/modules/team/routes/post-team-invitation.ts:11](../../apps/api/src/modules/team/routes/post-team-invitation.ts#L11) — router.post(
- [apps/api/src/modules/vehicle-images/routes/delete-listing-image.ts:12](../../apps/api/src/modules/vehicle-images/routes/delete-listing-image.ts#L12) — router.delete(
- [apps/api/src/modules/vehicle-images/routes/post-listing-image-commit.ts:12](../../apps/api/src/modules/vehicle-images/routes/post-listing-image-commit.ts#L12) — router.post(
- [apps/api/src/modules/vehicle-images/routes/post-listing-image-presign.ts:14](../../apps/api/src/modules/vehicle-images/routes/post-listing-image-presign.ts#L14) — router.post(
- [apps/api/src/modules/vehicle-images/routes/put-listing-image-primary.ts:12](../../apps/api/src/modules/vehicle-images/routes/put-listing-image-primary.ts#L12) — router.put(
- [apps/api/src/modules/vehicle-images/routes/put-listing-images-order.ts:14](../../apps/api/src/modules/vehicle-images/routes/put-listing-images-order.ts#L14) — router.put(
- [apps/api/src/modules/vehicles/routes/delete-vehicle.ts:10](../../apps/api/src/modules/vehicles/routes/delete-vehicle.ts#L10) — router.delete(
- [apps/api/src/modules/vehicles/routes/get-vehicle-suggestions.ts:12](../../apps/api/src/modules/vehicles/routes/get-vehicle-suggestions.ts#L12) — router.get(
- [apps/api/src/modules/vehicles/routes/get-vehicle.ts:9](../../apps/api/src/modules/vehicles/routes/get-vehicle.ts#L9) — router.get(
- [apps/api/src/modules/vehicles/routes/get-vehicles.ts:12](../../apps/api/src/modules/vehicles/routes/get-vehicles.ts#L12) — router.get(
- [apps/api/src/modules/vehicles/routes/lifecycle.ts:20](../../apps/api/src/modules/vehicles/routes/lifecycle.ts#L20) — router.post(
- [apps/api/src/modules/vehicles/routes/patch-vehicle.ts:15](../../apps/api/src/modules/vehicles/routes/patch-vehicle.ts#L15) — router.patch(
- [apps/api/src/modules/vehicles/routes/post-vehicle-request-reactivation.ts:15](../../apps/api/src/modules/vehicles/routes/post-vehicle-request-reactivation.ts#L15) — router.post(
- [apps/api/src/modules/vehicles/routes/post-vehicle-submit.ts:10](../../apps/api/src/modules/vehicles/routes/post-vehicle-submit.ts#L10) — router.post(
- [apps/api/src/modules/vehicles/routes/post-vehicle-withdraw.ts:15](../../apps/api/src/modules/vehicles/routes/post-vehicle-withdraw.ts#L15) — router.post(
- [apps/api/src/modules/vehicles/routes/post-vehicle.ts:13](../../apps/api/src/modules/vehicles/routes/post-vehicle.ts#L13) — router.post(
