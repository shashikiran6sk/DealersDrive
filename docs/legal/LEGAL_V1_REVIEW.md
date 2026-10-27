# Legal V1: audit, review and rollout

This is a new, deliberately smaller implementation based on main at d35d27a1.
The owner confirmed the following public business information on 24 October 2026:

- Operator: Shashikiran Lakshminarayanan, sole proprietor trading as Dealers-Drive.
- Business and grievance address: 19th Street, Lakshmipuram, Gandhinagar,
  Vellore 632006, Tamil Nadu, India.
- Grievance/privacy contact: Shashikiran Lakshminarayanan, Proprietor and Grievance Officer.
- Business email: support@dealers-drive.com; business mobile: +91 8015354298.
- Intended effective date: 24 October 2026, expressly requested by the owner.

**No mandatory identity/contact placeholders remain.** Personal contact channels
are not included. This is an interim V1 release pending external legal review,
not a representation of final lawyer approval or full statutory compliance.
No production database was accessed, reset or migrated. Nothing was deployed.

## Publication and operational review

| Severity             | Follow-up                                                                                | Recommended resolution                                                                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release prerequisite | Owner review of the final interim text and actual publication date                       | Review this PR before publication. If publication happens after 24 October, confirm the displayed date remains appropriate or move it forward. The text and receipts do not create retrospective acceptance.                                                                                |
| High                 | Actual production provider inventory, regions, subprocessors and transfer terms          | Confirm AWS/database hosting, Cloudflare R2, Google, MSG91, Resend, Vercel and configured Grafana Cloud against deployed settings and contracts. Repository configuration establishes the architecture, not the actual running settings.                                                    |
| High                 | Retention/deletion, identity documents and request operations                            | Confirm necessity and a retention schedule, controlled erasure procedures, backup handling, masked-Aadhaar enforcement and operational ownership of requests. No comprehensive automatic erasure schedule exists.                                                                           |
| High                 | Google Maps embeds and global analytics                                                  | Assess current cookies/requests and Vercel collection on private/auth routes, including URLs. Determine applicable grounds and any required separate choice/configuration changes. This PR discloses the integration; it adds no cookie banner and does not restore #279 analytics changes. |
| Legal review         | Marketplace/intermediary classification, statutory disclosures and Indian-law transition | Counsel should confirm requirements for this discovery/enquiry model and the sole-proprietor business, current amended rules, complaint handling and DPDP commencement. No legal compliance certification is claimed.                                                                       |

Publication metadata is shared in packages/contracts/src/legal-documents/v1.ts.
Production pages and enforcement use that same committed reference. Production
readiness fails closed if a mandatory field is absent. Nonproduction acceptance
requires LEGAL_V1_PREVIEW=true so existing development and regression fixtures
are unaffected; this preview value cannot override missing production details.
After publication, preserve V1 and add a new version for later revisions. A green
engineering check is not final counsel approval or permission to deploy.

## Reference history: PR #279 and its revert

- [PR #279](https://github.com/shashikiran6sk/DealersDrive/pull/279) merged as
  98614838bd732ccc6d63fd93316fb506c8ae0b55.
- [PR #331](https://github.com/shashikiran6sk/DealersDrive/pull/331) reverted the
  post-production tree in c4f3d227114054f111f1445982e88b4162bbf094. Its stated
  purpose was to restore main to production commit a969dc2c while mobile work
  continued separately. It states the eight later migrations had not reached
  production. This is documented history, not an independent production check.
- #279's review explicitly recorded unresolved legacy-enquiry masking,
  account-merge disclosure suppression, separate signup/acceptance transactions,
  independently configured web/API flags and unfinished counsel/business review.
- Current main contains no #279 policy routes, legal models, acceptance module or
  five legal migrations. Existing assistedConsentAt records OTP-authorized assisted
  profile preparation; it is not policy acceptance and is never reused as such.
- Reviewed #279's description, comments, changed-file list, legal drafts v1/v2/v3,
  all five legal SQL migrations, legal evidence/service/routes, onboarding and
  authentication changes and legal integration tests. Useful marketplace,
  photography, consumer-rights and grievance wording was adapted after checking
  current source. No merge/cherry-pick or old branch restoration was used.
- This implementation has two public documents, one checkbox per acceptance
  context and one acceptance table. No enquiry permission management, consent
  events, extra public archive pages, dealer agreement, listing certification,
  legal dashboard or #279 analytics/map changes return.

## Current architecture and exact authentication points

| Flow                     | Current behavior and Legal V1 boundary                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public browsing          | Public vehicle/dealer/search/config routers and public Next pages remain anonymous. Policies and Contact & Support do not require agreement.                                                                                                                                                                                                                                                               |
| Customer OTP             | Phone proof returns SIGNED_IN for an existing named account, or a sealed signup ticket with NAME_REQUIRED. Signup proves the ticket, creates/links the phone account, saves the name and issues a CUSTOMER session. Login is not legal acceptance. The existing login route then shows one checkbox before normal account actions.                                                                         |
| Customer Google          | There is no standalone customer Google login or customer Google callback in current main. Google authenticates dealer/admin accounts and links identities. Dealer-scoped person sessions with a verified name/phone can also use customer APIs. Tests exercise Google sign-in without implied acceptance, followed by explicit personal agreement. No new OAuth audience was invented.                     |
| Dealer Google            | completeGoogle creates/links the identity, ensures the dealer seat, issues the session and resolves membership/state. The callback and PKCE/state/account-linking logic are unchanged.                                                                                                                                                                                                                     |
| Dealer OTP               | Verified phone sign-in creates/resolves an account and dealer session, then uses the same post-auth membership/state resolution. No acceptance is inferred from OTP.                                                                                                                                                                                                                                       |
| Onboarding               | Account/business save creates DRAFT and OWNER membership; phone and Google linking remain prerequisites as before. Draft editing and document uploads remain accessible. The existing final Review & Submit contains the one checkbox if V1 is missing. Acceptance and DRAFT → PENDING_APPROVAL commit together. Failed submission leaves draft and agreement unchanged.                                   |
| Pending/approved dealers | Missing acceptance is handled by a small one-time gate; full onboarding is not repeated. Console layout checks before fetching protected data. Previously accepted members do not see the checkbox.                                                                                                                                                                                                        |
| Assisted onboarding      | Staff prove dealer phone/email and provision the OWNER account; original preparation consent is separate. Staff can prepare/edit/upload drafts. Dealer signs in with their own verified phone or Google, accepts, and may submit; staff may submit after that owner acceptance. Staff cannot forge a receipt. New approval/manual activation and assisted listing submission require dealership agreement. |
| Dealer roles             | Owner authority comes from current membership, checked again transactionally. A manager/staff member cannot agree for the dealership. Once its owner has agreed, other members can accept personally without changing their existing permissions.                                                                                                                                                          |
| Suspensions              | Existing account/seat/membership/dealer status checks still decide admission and transactional writes. Acceptance never grants a role, changes status, activates a dealer or reopens a suspended account.                                                                                                                                                                                                  |
| Account linking/merge    | Existing proof-of-both-identities merge is unchanged. Original personal receipts remain attached to their actor. Status can recognize a receipt on the authenticated survivor or its directly absorbed, proof-linked Google-only account; it never creates a replacement receipt. The existing merge invariant prevents phone-bearing survivors from being absorbed.                                       |

## Authorization and evidence

New authenticated endpoints: GET /v1/legal/status?scope=CUSTOMER or DEALER,
and POST /v1/legal/accept with scope and accepted=true. They use the existing
verified person session. Clients cannot supply user/dealer IDs, versions or dates.
Inputs are strict Zod contracts. Status is uncached. Acceptance uses fixed V1
versions and server time. A unique subject/version key and conflict-safe insertion
preserve the first timestamp across retries and concurrent sessions.

A personal receipt uses the account subject. A dealership receipt uses its stable
ID and the authenticated OWNER as actor. An owner agreeing for a dealership also
records personal agreement in the same transaction. There are no acceptance IPs,
user-agent strings, fingerprints or marketing permissions. There are no public
edit/delete/history endpoints. Database triggers reject update/delete/truncate;
retention maintenance requires a separately reviewed privileged procedure.

Middleware enforces agreement on customer enquiries, saved cars and invitations,
and ordinary dealer APIs. Browser actions reuse existing login navigation on a
legal-required refusal. Dealer draft profile/completeness/documents routes are
allowed during DRAFT/PENDING_APPROVAL; final submission itself checks agreement.
Authentication callbacks, identity linking, phone verification, workspace
selection, session lookup, logout, support tickets and public contact/policy routes
remain available. Workspace selection grants no account-action bypass.
Admin/sales access controls remain unchanged; activation/submission services check
the dealership receipt before granting contractual privileges. Acceptance JSON
requests reject untrusted Origin and cross-site Fetch Metadata; browser cookie
protection and Next server-action origin checks remain in place.

## Actual data lifecycle audit

- Google identity, verified phone/email, names, session IP/browser and role records
  are stored. Google passwords are not collected. MSG91 verifies OTP tokens.
- Onboarding stores private personal/business proofs, optional tax information,
  public business details and separately moderated portfolio photographs. Staff
  can store private business-visit evidence. Onboarding requests masked Aadhaar
  but does not automatically mask files. Identity verification is separate from
  dealer activation, dealer badge review and mechanical vehicle inspection.
- Listings contain registration/specification/price/history and photos. Staff
  photograph and moderate before publication. No inspection, warranty or insurance
  service is created or represented by Legal V1. StudioCar/image processing is
  unchanged.
- Enquiry creation copies the current customer name/verified phone and message to
  the relevant dealership's lead; authorized dealer users and service email
  notifications can receive it. Existing enquiries are not masked or re-permissioned.
- Saved vehicles are account-linked; local location/UI preferences and auth hint
  state exist in the browser. Support stores customer messages, replies, statuses
  and internal restricted notes. There is no current self-service account deletion
  or enquiry-sharing withdrawal facility. Public support remains the request route.
- Document reads use signed URLs and authorized access; input validation, role
  checks, rate limits and redacted operational logging exist. No claim of blanket
  encryption, certification, anonymization or India-only residency is made.
- Deployment documentation describes AWS infrastructure/database services and
  Cloudflare R2 (S3-compatible) object storage, not exclusively AWS S3. Production
  configuration requires MSG91 and Resend. Vercel analytics is in the root layout;
  private-route filtering and query stripping from #279 are absent. Google Maps
  embeds still load on dealer location cards. Grafana Cloud logging is configurable.
  Hosting contracts/actual settings and backup retention require owner confirmation.
- Specific maintenance jobs and configured log retention exist, but a full retention
  and deletion schedule is absent. Policies explicitly avoid fixed unverified periods.

## Indian-law review basis (checked 24 October 2026)

[MeitY G.S.R. 843(E)](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)
commences principal processing/notice/consent/rights provisions eighteen months
after Gazette publication; consent-manager provisions have a one-year phase.
[Final DPDP Rules G.S.R. 846(E)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
also have phased commencement. The policies do not claim these later duties or
remedies are already operative. Counsel should confirm exact commencement-date
calculation and rules in force at actual publication, including later corrections.
Applicable IT Act/2011 SPDI duties remain a current review item.

The [Consumer Protection (E-Commerce) Rules](https://thc.nic.in/Central%20Governmental%20Rules/Consumer%20Protection%20%28E-Commerce%29%20Rules%2C%202020.pdf),
read with the [2021 amendment](https://egazette.gov.in/WriteReadData/2021/227003.pdf),
require review of operator, principal address and appointed grievance disclosures,
complaint timelines and marketplace classification. Counsel must confirm exact
applicability and all necessary disclosures; support branding alone is not a statutory appointment. The owner has now supplied
the operator identity and grievance appointment. Do not rely on the superseded
original Rule 4(1) entity-form wording when assessing the sole proprietorship.

## Outstanding counsel questions

1. Confirm operator/entity disclosures, marketplace/intermediary classification,
   grievance appointments and service capacity for mandatory response timelines.
2. Confirm adulthood/eligibility wording, dealer authority, ownership transfers,
   manual activation disclosures and any dealer-class regulatory requirements.
3. Approve marketplace liability wording preserving our own negligence,
   misrepresentation, unlawful acts and non-excludable consumer rights.
4. Confirm photography commissioning/licences, promotional image use and fair
   presentation rules without claiming mechanical inspection.
5. Approve actual enquiry/contact-sharing purposes, provider disclosures and lawful
   grounds; decide necessary follow-up controls without treating this checkbox as
   blanket data-processing consent.
6. Finalize retention/deletion and Aadhaar practices, provider transfer terms,
   analytics/map assessment and DPDP transition work before the applicable deadlines.

## Migration, deployment and rollback

New additive migration: 20261024120000_legal_acceptance_v1. It creates only
legal_acceptances, its subject/version uniqueness, actor FK, validation checks and
immutability triggers. It does not add an acceptance default, modify user/dealer
rows, read old legal_events or change previous migrations. #279 fixtures exist only
under tests; none of its migrations returns to the deploy directory.

Before deployment, an authorized release owner must take/verify a backup and inspect
_prisma_migrations and the catalog for previously applied legal migrations/tables.
Never assume the Git revert reverted a database. Retain any old applied migrations
and historical evidence. Do not run migrate dev, reset, db push or automatic drift
repair against production. Rehearsals cover both current-main and #279-applied
histories with Prisma migrate deploy and preserve every preexisting row/checksum.
Resolve failed/partially applied old migrations explicitly before deployment;
this PR does not auto-resolve them.

1. Review final interim text and the owner-confirmed effective date, freeze the V1
   reference and digest, and run all gates again before any release.
2. Build API and web from the same committed policy revision. Do not run a mixed
   active policy revision or publish uncommitted content.
3. Apply the additive migration before any new application binary. Verify it is
   finished on the target database and the new table is readable.
4. Release matching API and web together in a coordinated release/maintenance
   window, using staged traffic if available. Keep old traffic drained until both
   are ready; smoke-test public policies, OTP/Google, missing/recorded acceptance,
   support and dealer owner submission before promoting traffic.
5. Do not deploy an enforcing API while the matching web acceptance UI is absent.
   This PR performs none of these production actions.

Rollback: drain traffic and redeploy the previous matched API/web pair. Leave the
additive table, triggers, existing receipts and old #279 tables/history in place;
old code ignores the table. Code rollback also removes enforcement, so any rollback
after legal activation needs owner/counsel risk assessment. Do not delete receipts
or mark anyone accepted to make rollback easier. No destructive down migration is
provided; schema removal/retention is a separately reviewed operation.

## Verification and screenshots

Results and local evidence are recorded in `docs/testing/legal-v1/RESULTS.md`.
Screenshots show the confirmed V1 text and synthetic/local account data. They are
engineering review evidence, not proof of production configuration or final legal
approval. Real provider/device UAT remains a release-owner task; automated auth
regressions use the established fake Google/OTP ports and real session/database paths.
