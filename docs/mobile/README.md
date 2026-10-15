# Dealers-Drive Android — revised audit and stacked implementation plan

**Status: START authorized the ten-PR implementation. F099–F108 are open/draft (#312–#321), each targeting its predecessor above #279. F108 validation is in progress; production verdict remains NO-GO. PR merges and production release remain separately gated.**

Re-audited 14 October 2026 against **PR #279**, not main. This revision supersedes the earlier main-based findings about missing policies/consent and the original standalone policy PR. Other customer discovery, native security, accessibility, performance, testing and Play requirements remain in scope.

The original plan was included on local F099 after the earlier START. The branding amendment was documentation-only. The subsequent explicit START authorizes resuming this amended plan and the proposed parent-into-child merge. Preserve existing F099 commits and protected refs. Current/previous baseline evidence and actual ancestry are distinguished in the manifest.

## 1. Executive recommendation

Build the customer-only Android application with React Native, Expo, TypeScript, Expo Router, TanStack Query, Expo SecureStore, and the existing Express/PostgreSQL infrastructure. Follow the original responsive-web visual baseline and customer scope. No WebView wrapper, second backend/database, privileged native screens, iOS implementation, or unrelated redesign.

Use **ten incremental mobile PRs**, each based on its immediate predecessor, descending from PR #279. Eliminate the original separate policy implementation PR: the foundation already implements the authoritative legal models, policy snapshots, consent, withdrawal, web controls, and associated tests. Native policy integration fits into native auth, account, and consent PRs.

Do not duplicate policy tables, consent records, notices, hashes, acceptance logic, or withdrawal rules. Native-specific transport, current-policy retrieval, safe mutation retries, and deletion fulfillment remain genuine additions.

**Implemented legal infrastructure is not approved legal publication.** Current Terms/Privacy/notices remain drafts, production release is blocked, and implementation approval will not authorize publication or enforcement activation.

## 2. Verified Git foundation — branding amendment

Latest origin refs were fetched on 14 October 2026. GitHub metadata was rechecked at **2026-10-14 12:51:40 UTC**.

| Field                            | Verified value                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| Current origin/main              | `a969dc2c5223ddb04c23d720ded6a4daccfe33ab`                                           |
| Branding PR                      | [#311](https://github.com/shashikiran6sk/DealersDrive/pull/311), MERGED              |
| Branding merge commit            | `a969dc2c5223ddb04c23d720ded6a4daccfe33ab`                                           |
| Branding merge time              | 2026-10-14T12:26:44Z                                                                 |
| Legal foundation PR              | [#279](https://github.com/shashikiran6sk/DealersDrive/pull/279), OPEN/DRAFT/unmerged |
| Legal source branch              | `feature/legal-compliance-and-consent-v1`                                            |
| Updated foundation head          | `6180a4b52522493b884550448d0a84e7d95432df`                                           |
| Legal PR base                    | main at `a969dc2c5223ddb04c23d720ded6a4daccfe33ab`                                   |
| Previous audited foundation      | `22c98419119f0418ba9d7cbcb7ec398052216bbf` — historical only                         |
| Local branch before amendment    | feat/f099-mobile-foundation at `bcb1bee7e4db4f999a2081665512471b0266507d`            |
| Mobile PRs at amendment snapshot | #312 OPEN/DRAFT; F100–F108 not created                                               |
| Required restack                 | Approved START: parent merged into F099 as fb02d063; original F099 preserved         |
| Working tree before amendment    | Clean                                                                                |

The owner-created foundation merge has parents `22c98419119f0418ba9d7cbcb7ec398052216bbf` and `a969dc2c5223ddb04c23d720ded6a4daccfe33ab`. Both original legal work and PR #311 are ancestors. All four approved SVG masters are present and byte-identical to main. Inspection uses Git refs, not the older F099 checkout.

GitHub reports SUCCESS for all reported #279 checks at the new head, including lint/typecheck/test/build and security. These are observed remote results; no application suite was rerun for this amendment. No legal approval or Android validation is inferred.

The ten feature IDs/parent relationships remain unchanged. The initial amendment preserved the existing F099 commit and held uncreated children behind START. Current state: all ten mobile drafts #312–#321 exist against their immediate predecessors; use the manifest and implementation checkpoints below for verified heads/checks. Protected main/#279 and existing histories remain preserved.

Source compatibility: no changes to Prisma/migrations, shared contracts, legal/identity/enquiry/saved/support services, policy pages/content or legal/enquiry UI logic compared with the previous foundation. No conflict markers in 34 inspected legal/consent files. Changes touch shared branding shells, approved SEO/image references and email-header artwork. Footer legal links remain intact. Changed-file overlap with F099 is empty, but runtime regressions/native rendering still require tests after an approved restack.

## 3. PR #279 feature audit

Source paths and line numbers refer to the pinned head above. Source inspection is stronger evidence than historical reports; historical test/browser artifacts are identified separately.

| Area                          | Verified implementation                                                                                                                                     | Native consequence                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Terms and Privacy             | Two canonical document objects selected by `LEGAL_DOCUMENTS`; versioned V1/V2/V3 source archives                                                            | Render the same approved snapshots, not mobile-written legal text                           |
| Current versions              | Terms `2.0-draft.1`; Privacy `2.0-draft.2`; sharing/certification notices `2.0-draft.1`                                                                     | Preserve independently versioned documents/notices                                          |
| Review/publication            | `LEGAL_RELEASE_APPROVED=false`, `reviewed=false`, effective dates null; `legalReleaseReady()` blocks draft release                                          | No production publication/acceptance bypass                                                 |
| Database publication metadata | Immutable `legal_policy_versions` rows with document/version/digest/publication state/approval reference/effective timestamp; migrations insert drafts only | Reuse registry; no duplicate mobile publication table                                       |
| Production acceptance checks  | Verify matching published metadata, digest, approval reference, effective timestamp/source date                                                             | Native adapter must use these checks, not only a client flag                                |
| Customer registration         | Optional `agreement` on existing strict signup input; existing service validates and records Terms ACCEPT and Privacy ACKNOWLEDGE separately                | Native signup calls the same identity and evidence services                                 |
| Account updates/history       | Customer legal status/terms/history routes; own history bounded to 100; verified merged-account history retained without rewriting events                   | Native Agreements screen and version-update checkpoint                                      |
| Dealer contract               | Active authorized OWNER at final successful submission; personal and dealership receipts distinct; activation/listing/lead gates                            | Keep existing web enforcement; no native dealer acceptance screen                           |
| Sharing                       | Append-only grant/withdrawal events scoped to authenticated customer, actual dealership, purpose/categories, notice version/hash, scope digest, expiry      | Native consumes existing status and submits existing contract                               |
| Same-dealer reuse             | Effective grant reused only for another explicit enquiry action                                                                                             | Do not show redundant checkbox; never auto-submit                                           |
| Different dealer/transfer     | Listing/vehicle ownership checked under locks; supplied recipient compared to actual receiver                                                               | Review changed recipient and request fresh consent                                          |
| Withdrawal                    | Grant withdrawal marks linked enquiries; per-enquiry legacy withdrawal exists; retries deduplicate                                                          | Native privacy controls call existing routes                                                |
| Future disclosure             | Dealer mapper masks name/phone/message; dashboard suppresses disallowed previews; notification permission rechecked before send                             | Retain all server controls; no client-side substitute                                       |
| Re-grant                      | New grant for subsequent eligible enquiries; old withdrawn enquiries remain withdrawn                                                                       | Never restore old enquiry disclosure locally                                                |
| Transactionality              | Listing/vehicle locks, customer/dealership advisory lock, duplicate-open lock; grant/enquiry/DISCLOSE/audit/outbox in one transaction                       | Reuse service; only add transport/retry capabilities when necessary                         |
| Snapshot/evidence             | Server-generated deterministic JSON SHA-256 and event keys; append-only triggers; exact old snapshots retained                                              | Client submits displayed versions; never computes independent evidence hashes               |
| Flag rollback                 | Disabling collection still respects known grants/withdrawal/history; supplied collection payload rejected while disabled                                    | No fallback to unpermissioned enquiry after withdrawal                                      |
| Account deletion              | `/data-rights` links to Account Issue support with Privacy request subject; unauthenticated contact option remains                                          | Request channel exists; verified fulfillment/status/erasure are incomplete                  |
| Directions                    | Public iframe removed; `embedUrl=null`; server returns validated coordinate/address/share-link destination                                                  | Reuse returned `mapsUrl`; no client geocoding/map SDK                                       |
| Web analytics                 | Public-route filtering and query/fragment stripping; independent Privacy draft update                                                                       | Do not import Vercel web analytics into native or treat acknowledgment as analytics consent |

Key evidence:

- `packages/contracts/src/legal.ts:10–156`: registry, versions, schemas, snapshot lookup and release gate.
- `packages/contracts/src/legal-documents/v1.ts`, `v2.ts`, `v3.ts`: exact draft and historical content.
- `apps/api/src/modules/legal/legal.evidence.ts:28–63,95–221,224–255,300–337`: enablement, distinct receipts, owner authority, publication checks.
- `apps/api/src/modules/legal/contact-sharing.ts:19–55,73–161,186–202`: scope, grant/reuse/withdrawal and disclosure checks.
- `apps/api/src/modules/enquiries/enquiries.service.ts:266–329,333–452`: status, permissions, withdrawal and atomic creation.
- `apps/api/src/modules/enquiries/enquiries.mapper.ts`, `apps/api/src/modules/admin/admin.service.ts`, `apps/api/src/modules/notifications/notifications.service.ts`: downstream disclosure controls.
- `apps/web/src/lib/legal-release.ts:4–32`, `apps/api/src/config/env.ts:260–265`: production gates.
- `apps/web/src/features/legal/rights-controls.tsx:27–55`: support-backed rights/deletion request path.

These files can be inspected at the [pinned foundation tree](https://github.com/shashikiran6sk/DealersDrive/tree/6180a4b52522493b884550448d0a84e7d95432df).

Important limitations: database triggers are not cryptographic protection against an administrator; already delivered/in-flight external messages cannot be recalled. Account merge does not silently expand sharing: canonical customer identity must grant separately, while verified merged identities may withdraw historical grants. Re-grant does not bypass the existing duplicate-open enquiry rule for the same car.

## 4. Changes to the old audit and UI scope

| Earlier main-based finding/proposal         | Revised conclusion                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Terms/Privacy absent                        | Present on #279 as gated review drafts; production approval still absent |
| Dealership consent absent                   | Implemented on #279; use existing service/records/routes                 |
| Need new consent tables/endpoints           | Remove duplicate proposals                                               |
| Need coordinated web consent implementation | Already in foundation; retain and regression-test                        |
| No deletion request channel                 | Support-backed web request exists; verified fulfillment remains a gap    |
| Maps iframe requires native adaptation      | Foundation already removes iframe and returns directions URL             |
| Eleven PRs including standalone policies    | Ten mobile PRs; integrate policies in auth/account/consent               |
| Main `69bf798b` is build ancestry           | Reference only; actual ancestry is #279 head                             |

All original customer screens remain: Home, Cars/search/district/filter/sort, `/car/[slug]`, gallery, Dealers, `/dealers/[slug]` with inventory, phone login/signup, Saved, enquiries, `/contact`, support list/new/conversation, Profile/settings, errors, sharing/app links.

Additional foundation-visible routes to reproduce appropriately:

- `/terms`, `/privacy`: headings, current version/effective status, sections/anchors and links.
- `/agreements`: account acceptance/acknowledgment checkpoint, history, permanent version references; exclude dealer binding controls.
- `/data-rights`: dealership permissions, selected legacy enquiry withdrawal, access/correction/deletion support entry; not gated by new Terms acceptance.
- `/legal/[document]/[version]` and `/legal/notices/[notice]/[version]`: retained immutable references; native reader or approved system browser, subject to the same publication gates.
- `/dealer-terms`, `/listing-policy`, `/grievance`: permanent anchored Terms redirects, not separate newly invented mobile policies.

Use Home/Explore/Saved/Profile tabs. Preserve cards, neutral colors, Manrope for body text, hero/dealer illustration, hierarchy, states, Android Back, keyboard/insets, 48dp targets and TalkBack. Branding now comes exclusively from PR #311's standalone DD and separate outlined wordmark; never substitute ordinary text or old screenshots. Dealer/admin/sales/invitation/workspace interfaces remain web-only.

Inspected foundation screenshots include `docs/testing/legal-consent/2026-10-13/account-acceptance-mobile.png` and `full-stack-regrant-mobile.png`. They show local/synthetic browser evidence, not native screenshots or live OTP success. Checked state in a capture is not the initial state: source initializes the relevant choices unticked. The browser report records 32 checks, zero failures/skips; it was reviewed, not rerun here.

### 4.1 Approved brand identity and native preparation

PR #311 already implements the new identity on the website. Reuse exact masters from the updated foundation, with no new branding PR/redesign.

| Asset                                      | Source viewBox | Usage                         |
| ------------------------------------------ | -------------- | ----------------------------- |
| Standalone DD black/white                  | 0 0 651 424    | Black on light; white on dark |
| Separate DealersDrive wordmark black/white | 0 0 1092 145   | Black on light; white on dark |

Variant pairs have identical path geometry and alpha coverage. Masters have transparent exteriors, no embedded rasters, no text elements, and one SVG path each. The [branding inventory](branding-assets.md) records exact hashes, references, planned outputs and acceptance criteria. Manrope remains body typography; it is not wordmark artwork.

Updated web source uses the black symbol 24px high/about 37px wide in the customer header and visually hides the wordmark below 640px. Full lockup/drawer/auth presentation uses the separate wordmark around 136px wide/18px high with 10px gap. Match actual updated components at 360/393/412dp; preserve native tabs/safe areas instead of copying web-only navigation. Reviewed post-#311 browser captures are references, not native/device proof.

Native primitives will expose independent symbol, wordmark and composed lockup, with correct surface variant and one accessible lockup label. No baked rounded tile, border-radius clipping, recreated lettering, stretching or arbitrary recoloring. Existing native SVG/image capabilities suffice; no branding dependency is required.

Planned preparation after a fresh START approving the amended plan/restack:

- Copy four SVG masters verbatim with provenance hashes; derive PNG only where Expo/Android requires it, using existing tooling and uniform scaling.
- Keep native display resources transparent; symbol aspect ratio is 651:424 and wordmark 1092:145.
- Launcher/Play icon contains DD only. Use an already approved flat light/black surface treatment with the matching black/white symbol; never a wordmark or obsolete tile.
- Adaptive foreground is transparent, centered on a 108×108dp-equivalent canvas; fit the artwork inside the official central 66×66dp safe area. Background is separate. Validate alpha bounds and circle/squircle/OEM masks before choosing final scale; do not copy browser favicon or PWA maskable PNG blindly.
- Splash uses standalone DD only, contain mode and correct proportions; black on light/white on dark. Validate Android system splash in a release build.
- Feature graphics may compose the two independent assets; launcher/store icon artwork must not include the wordmark.
- Retain app display-name/package decisions and all legal/customer text; artwork spelling does not rewrite policy content or evidence hashes.

Resumed F099 replaces the old tile-plus-Text logo and raster resources with the approved independent SVG masters and generated symbol-only launcher/adaptive/splash resources. The light native theme uses the SDK-matched Expo system UI module. No web UI or legal content is changed by native adoption.

References: [Android adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive), [Expo splash/icon guidance](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/). Native resources/screenshots/device validation remain pending.

## 5. Existing APIs to reuse for native legal integration

Customer principal only; private responses no-store. Existing legal routes are mounted at `apps/api/src/routes.ts:64–66`. Native must use the CUSTOMER namespace and must not copy the web helper's dealer/account/customer probing.

| Endpoint                                              | Contract/behavior                                                                                                               | Native use                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| GET `/v1/legal/customer/status`                       | `LegalStatus`: enabled, Terms version, termsRequired/privacyRequired, plus dealer-related fields                                | Own agreement checkpoint; ignore privileged fields without exposing dealer UI |
| POST `/v1/legal/customer/terms`                       | `TermsAcceptanceInput`: version, accepted=true, privacyAcknowledged=true, privacyVersion; service checks exact current versions | Explicit account choice; distinct receipts                                    |
| GET `/v1/legal/customer/history`                      | `LegalHistory`, own/merged history, most recent 100                                                                             | Agreements/history                                                            |
| GET `/v1/enquiries/sharing-status?listingSlug=...`    | `SharingStatusQuery` → `SharingStatus` (required, recipientId, dealerName)                                                      | Server-authoritative form preparation                                         |
| GET `/v1/enquiries/sharing-permissions`               | `SharingPermissions`, effective own grants                                                                                      | Privacy controls                                                              |
| POST `/v1/enquiries/sharing-permissions/:id/withdraw` | `SharingGrantParam` → `{withdrawn:true}`; owns grant; repeated withdrawal safe                                                  | Dealership-wide withdrawal                                                    |
| GET `/v1/enquiries/:id`                               | `LegalEnquiryParam` → `CustomerEnquiry`; own-only 404                                                                           | Older enquiry/privacy context                                                 |
| POST `/v1/enquiries/:id/withdraw-sharing`             | Own enquiry; withdraw linked grant or legacy enquiry; `{withdrawn:true}`                                                        | Existing enquiry-level entry; explain linked-grant scope                      |
| POST `/v1/enquiries`                                  | Existing `CreateEnquiryInput` adds optional sharing/recipientId; conditional server enforcement                                 | Same service, expected receiver and required sharing only                     |
| POST `/v1/auth/sign-up/customer`                      | Existing `CustomerSignUpInput` adds optional agreement                                                                          | Existing native wrapper reuses this service                                   |

Relevant errors: AGREEMENT_REQUIRED, AGREEMENT_VERSION_CHANGED, PRIVACY_VERSION_CHANGED, LEGAL_NOT_ACTIVE, LEGAL_PUBLICATION_NOT_READY, ENQUIRY_PERMISSION_REQUIRED, SHARING_NOTICE_CHANGED, ENQUIRY_RECIPIENT_CHANGED, existing unavailable/reserved/duplicate and ownership failures.

Account policy acknowledgment is not dealership sharing consent. Neither authorizes analytics or marketing. A Privacy-only update does not expand/revoke the separately versioned sharing grant. A sharing notice/scope/recipient change requires a fresh choice.

When enforcement is off, omit agreement/sharing collection payloads as the foundation requires. If known sharing history cannot be reused, show refusal/unavailability; never bypass it by removing fields/retrying against a legacy route. Production release still requires approved policies and the required consent behavior, not permanently disabled collection.

The legal Origin middleware rejects an unapproved present Origin and accepts absent Origin. Native normally has no browser Origin. Preserve that behavior and test authenticated native requests; do not spoof a web Origin or weaken CORS/cookie protections.

## 6. Genuine backend gaps and minimal additions

### 6.1 Native authentication

Keep existing User identity resolution, phone proof, signup tickets and opaque Session store. Add backend-mediated MSG91 request/resend/verify challenges and native JSON credential issuance/logout/session introspection. SecureStore holds credentials. Customer-only bearer parsing must never be added globally to dealer/admin/sales cookie resolvers.

Retain no-password phone signup/login, NAME_REQUIRED, suspended/collision handling, 30-day opaque session model unless separately approved, no automatic refresh invention, no Google customer login in v1. Validate fresh proof/rate/spend/expiry controls and real DLT/provider integration. Browser auth remains compatible.

### 6.2 Current policy/notice retrieval

#279 renders shared documents through Next.js but exposes no general JSON document/current-sharing-notice endpoint. LegalStatus returns Terms version but not current Privacy version/text/digest; SharingStatus returns receiver/required state but not current notice version/text. An installed app's bundled drafts cannot be authoritative after server policy updates.

Add a thin public publication/bootstrap endpoint in Mobile PR 2 (proposed GET `/v1/legal/publication`) using existing document/notice snapshots and publication validation. Return current versions, reviewed/effective availability, approved content or canonical/version links, relevant notice text, server digests, and collection status. Optionally address an approved historical snapshot through the same adapter if the native reader needs it. No new policy model/version/CMS.

Production must never expose draft content through this adapter. Nonproduction preview can label existing drafts for tests. Unknown/stale/unavailable metadata cannot cause native acceptance or submission. Client echoes the displayed versions; server constructs hashes/evidence. Inspect release bundles to avoid accidentally including draft archives via broad contract imports.

Legal coverage also needs native review: the current Terms describe the website, and the current Privacy amendment specifically addresses Vercel web analytics. Do not assume these drafts fully disclose Android secure storage, server-mediated OTP processing, Expo distribution or any approved mobile crash SDK. Owner/counsel-approved changes must use the same immutable version registry and publication process, not independent mobile policies. No additional standalone policy implementation PR is justified yet; identify any genuine integration gap before expanding the ten-PR stack.

### 6.3 Reliability and hydration

- Existing open-enquiry locking prevents duplicate open enquiries, but is not request idempotency. Optional payload-bound create retry IDs may be added in Mobile PR 7, preserving legacy callers and transactional consent/outbox semantics.
- Support message retry IDs/quota/reopen already exist on foundation. Reuse them. Ticket creation still lacks request idempotency; add only if needed in Mobile PR 8.
- Saved slugs remain capped at 500; complete hydration/pagination is a narrow Mobile PR 6 adaptation, not a new save database.
- Bounded legal history and recent-50 rights UI are current limitations. Preserve explicit limits; do not claim exhaustive history. Existing own-enquiry lookup supports older withdrawal context.

### 6.4 Account deletion

Reuse the existing support-backed privacy request entry and communication channel. Add only the verified request/fulfillment capability that is absent: fresh identity proof, idempotent intake/status, supported erasure actions, retention/holds, session revocation, processor/backups handling and auditable completion. A minimal typed deletion record linked to an existing support ticket may be justified; it is not a parallel policy/consent model.

Multi-role ownership and append-only legal/sharing evidence require counsel-approved retention and reviewed privileged maintenance. Do not disable immutability triggers or delete shared Users blindly. Support ticket creation alone cannot be called completed account deletion. Final scope must follow the approved operational retention procedure; unresolved procedure is a release blocker, not permission to invent one.

## 7. Final ordered stack and exact PR relationships

F099 is open/draft as [PR #312](https://github.com/shashikiran6sk/DealersDrive/pull/312), targeting the legal foundation branch. Original bcb1bee7 is preserved and the updated parent is an ancestor. F100–F108 were planned at that checkpoint and are now open drafts #313–#321. Their actual pinned base/head SHAs and checks are recorded in the manifest; do not recreate occupied branches.

| PR                             | Proposed head branch                      | GitHub base branch                        |
| ------------------------------ | ----------------------------------------- | ----------------------------------------- |
| #279                           | `feature/legal-compliance-and-consent-v1` | `main`                                    |
| Mobile 1 — Foundation          | `feat/f099-mobile-foundation`             | `feature/legal-compliance-and-consent-v1` |
| Mobile 2 — Auth backend        | `feat/f100-mobile-auth-backend`           | `feat/f099-mobile-foundation`             |
| Mobile 3 — Auth UI             | `feat/f101-mobile-auth-ui`                | `feat/f100-mobile-auth-backend`           |
| Mobile 4 — Cars/search/gallery | `feat/f102-mobile-cars-search-gallery`    | `feat/f101-mobile-auth-ui`                |
| Mobile 5 — Home/dealers        | `feat/f103-mobile-home-dealers`           | `feat/f102-mobile-cars-search-gallery`    |
| Mobile 6 — Saved/account       | `feat/f104-mobile-saved-account`          | `feat/f103-mobile-home-dealers`           |
| Mobile 7 — Consent/enquiries   | `feat/f105-mobile-consent-enquiries`      | `feat/f104-mobile-saved-account`          |
| Mobile 8 — Support             | `feat/f106-mobile-support`                | `feat/f105-mobile-consent-enquiries`      |
| Mobile 9 — Deletion            | `feat/f107-mobile-account-deletion`       | `feat/f106-mobile-support`                |
| Mobile 10 — Hardening          | `feat/f108-mobile-release-hardening`      | `feat/f107-mobile-account-deletion`       |

The required foundation is now `6180a4b52522493b884550448d0a84e7d95432df`. Existing F099 started at `22c98419119f0418ba9d7cbcb7ec398052216bbf`; approved normal merge `fb02d063fa2d50c0d99505d7adfe15e456f9f826` integrates the new parent and preserves original F099 ancestry. Later branches start from their immediate parent's reviewed head. No main-based branch or empty PR.

Maintain `docs/mobile/stack-manifest.json` in Mobile 1 after START, and a current stack-wide review snapshot as work progresses. Fields: sequence/feature/name, PR URL/number/state/draft, head branch/SHA, base branch and base SHA at creation/current verification, foundation SHA, predecessor/dependencies, incremental diff range, checks and their tested SHA, review state, evidence/known blockers, verification timestamp, restack history. The manifest records the open F099 draft and retains future fields null/NOT_CREATED.

## 8. PR-by-PR scope, dependencies and acceptance

Every PR is cumulative in branch history but incremental against its immediate base. Each carries its own bounded diff, tests, docs, exact SHAs, CI/test evidence and risks. Shared foundation regressions remain acceptance checks. Keep all PRs open/unmerged.

| PR  | Scope/file areas                                                                                                                                                                 | Backend/DB dependencies                                                                           | Required evidence/acceptance                                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/mobile` Expo/TS/theme/navigation/API/tests; PR #311 separate black/white symbol/wordmark primitives and launcher/adaptive/splash; lean exports/docs/allocations/stacked CI | Existing public contracts; no DB                                                                  | Type/lint/unit/bundle; source hashes/variant geometry/transparency/proportions/spacing/safe-zone tests; no obsolete art; correct React/boundaries/ancestry; feature-base CI                                         |
| 2   | Native OTP/session transport under API auth; customer bearer guard; legal publication adapter/shared response schemas/OpenAPI                                                    | Existing legal models/snapshots; shared cache challenge; existing Sessions; no duplicate policies | Provider contracts/cache failure/rate limits/expiry/identity; bearer denial on dealer/admin/sales; publication draft/stale/hash/effective gates; existing cookie/legal origin regressions                           |
| 3   | Native phone/OTP/name/session/pending; PR #311 auth/loading/error branding; policy reader/account choice/current-version errors                                                  | PR2 and foundation signup/evidence services                                                       | Unticked explicit choice; separate ACCEPT/ACKNOWLEDGE; existing identity; no private flashes/leakage; cancel/background/process death; auth-resume exactly-once save effect and no auto enquiry; emulator captures  |
| 4   | Cars/search/district/filters/sort/cards/detail/similar/gallery/share                                                                                                             | Existing public APIs/lifecycle                                                                    | Query semantics/loading/empty/error/removed-reserved; native paging/back/keyboard/accessibility; measured request cancellation; screenshots                                                                         |
| 5   | Home discovery/hero; dealer directory/profile/gallery/inventory/directions                                                                                                       | Existing config/dealer APIs including #279 directions                                             | Post-#311 mobile headers/variants; partial failures/fallback/context; no auto map request; screenshots                                                                                                              |
| 6   | Saved synchronization/Profile/settings/Agreements/history/privacy control entry; slug hydration adaptation if needed                                                             | Existing Saved/User/LegalHistory; no new save table                                               | Cross-platform PUT/DELETE; >500 correctness; lifecycle/ownership/rollback; read-only identity; historical/current document labels; safe account change/logout                                                       |
| 7   | Native enquiry/history/sharing controls/withdrawal and existing state rules; optional create retry ID                                                                            | Existing ContactSharingEvent/LegalEvent/Enquiry; nullable retry field only if required            | Same/different dealership; recipient transfer; notice/expiry/withdrawal/regrant; concurrent create/withdraw; no old-row restoration; lost-response retry has no duplicate event/email; existing web flows unchanged |
| 8   | Support list/new/conversation/reopen/quota/privacy-request prefill; create retry protection                                                                                      | Existing SupportTicket/Message; existing quota migration; optional create-ID uniqueness           | Five-unanswered limit/reset; explicit reopen; closed refusal; foreign ticket/enquiry 404; stable clientMessageId retries; support/privacy accessible without new Terms; screenshots                                 |
| 9   | Native and public-web deletion entry/status; verified backend/operational fulfillment linked to existing support                                                                 | Approved retention/multi-role procedure; minimal deletion-state persistence if justified          | Ordinary/multi-role requests; fresh proof; idempotent intake; revoked sessions; verified data disposition; preserved authorized evidence; no false completion; manual operator acceptance                           |
| 10  | Android E2E/security/performance/accessibility; CI/native build/EAS config/signing/app links/crash redaction; store assets/go-no-go                                              | All prior PRs; owner provider/device/Play access; approved legal publication external gate        | Release AAB; launcher/adaptive/splash/display-name/Play graphics/release screenshots/densities/contrast; manifest/16KB/live gates/draft holds; exact CI/SHA; no upload/deploy                                       |

Legal publication approval is not an extra mobile coding PR merely to preserve the old count. If re-audit or implementation reveals an independent required legal adaptation, document the gap and seek approval before adding an eleventh PR; never force an empty ten-PR sequence or duplicate foundation work.

## 9. Migration and compatibility plan

Foundation dependencies, preserved verbatim:

1. `20261008120000_legal_evidence`: append-only legal events, enquiry withdrawal timestamp, immutability triggers.
2. `20261013120000_dealership_contact_sharing`: grant/withdrawal history, uniqueness, enquiry grant FK and concurrent index; adds DISCLOSE action.
3. `20261013130000_legal_publication_metadata`: immutable policy registry; eight DRAFT snapshots.
4. `20261013140000_analytics_privacy_notice`: ninth DRAFT snapshot for independent Privacy amendment.

All existing main migrations, including `20261010120000_ticket_message_limits`, remain prerequisites. Native additions append migrations only for genuinely new retry/deletion state. Do not edit/recreate foundation migration files, mark unknown production schema as applied, drop evidence, change old hashes or backfill inferred consent.

The concurrent index cannot be blindly wrapped in a transaction. Rehearse clean and realistic upgrade paths on disposable production-shaped databases; set reviewed deployment lock/statement timeouts; verify FK/constraint validation and append-only behavior. Production inventory/reconciliation/migrations require separate owner authorization.

Compatibility tests cover web OTP/Google/dealer/admin/sales/owner flows, account merges, strict DTO additions, public inventory, saves, legal-origin checks, same-user activity, dealer lead masking and notification suppression. Native cannot weaken existing enforcement because a checkbox/API adaptation is inconvenient.

Current foundation production policies remain unpublished. The earlier production API observation at `d423db1c` is historical, not proof of today's deployment state; verify the approved deployed revision again before any release. Never choose the web host as the API base merely from an old example.

## 10. CI and evidence strategy

**New workflow gap:** current CI and security pull-request triggers filter base branch `main`; feature-base mobile PRs would not automatically receive those same checks. Mobile PR 1 must add appropriately scoped feature-base CI/security coverage (or a dedicated mobile-stack workflow) without enabling production deploys. Pending/missing checks are not PASS.

Run frozen install, correct Node, contracts build, affected lint/type/unit/component/bundle checks. Backend changes require strict contract/OpenAPI/cookie/bearer/role/resource/real-PostgreSQL migration and regression tests. Use isolated disposable DBs: existing API setup drops/recreates its test database. No tests against production or accidental real provider configuration.

Use Jest/jest-expo/RN Testing Library and Maestro for native. Relevant foundation references: `apps/api/tests/legal-consent.test.ts` (reuse/withdrawal/races/transfer/publication/rollback), legal evidence unit tests, contract snapshot tests, legal web UX tests, and browser artifacts. Rerun affected tests per mobile head rather than claiming old results apply.

Each PR report includes URL, branch, expected/actual base branch, base-at-start SHA, current base/head SHA, pinned #279 SHA, incremental diff/stat, CI links/status/tested SHA, local commands/results, screenshots/emulator/device, known blockers, and review state. Verify GitHub base/head after creation with read-only metadata; a PR targeting main is a workflow error requiring immediate safe correction, not acceptance.

Native screenshots/device measurements do not exist yet. Foundation's remote checks are green; all planned mobile checks are NOT_CREATED. Physical devices/live OTP, provider delivery, deletion operations and Play review remain manual/external evidence.

## 11. Native architecture and acceptance retained from Phase 1

Use `apps/mobile` and customer feature modules, no privileged placeholders. Preferred SDK baseline remains stable Expo 57 with its compatible RN/React versions, validated and locked at START; do not force web React resolution into Metro. Share platform-neutral schemas/domain helpers, not Next/Prisma/server secrets or DOM UI. Minimize libraries and permissions.

Query owns server state; small auth/pending reducers own client state. Validate stored credentials once while public discovery loads independently; customer-keyed private caches clear on account change/logout. Safe GET retries/cancellation; no offline mutation replay. Pending Save can resume an idempotent PUT; enquiry always resumes a form and needs explicit submission/current consent. Process restart does not execute persisted mutations.

Policy-update flow: load current server metadata, display versioned documents, collect correct account acknowledgment, query current recipient/sharing requirement, and submit existing DTO. Do not calculate legal hashes on-device or trust cached `accepted=true`. Privacy controls/support/deletion entry remain accessible when renewed Terms are declined.

Performance targets remain proposed, unmeasured: cold usable shell p95 ≤3s budget/≤2s mid-range; warm ≤1s; normal-4G useful inventory ≤3s; cached detail within 200ms; uncached detail p95 ≤2s; suggestions about 250ms debounce/≤1s after debounce; target 60fps; provisional PSS ≤250MB/no monotonic 20-cycle growth; crash-free objective ≥99.8% with sample size. Measure release builds on budget/mid-range devices, normal/degraded/offline networks; no fabricated benchmarks.

Testing retains guest/auth/signup/expiry/save/enquiry/back/deep-link/gallery/filter/support cases, cross-platform identity/save/consent/support synchronization, account isolation, privileged endpoint denial, secure storage/log scanning, keyboard/insets/TalkBack/large text, Android minimum/API36/16KB compatibility, app lifecycle and real-device/live-provider validation.

## 12. Safe implementation and restacking workflow

### Resume after this documentation-only amendment

1. Obtain a fresh START approving this amended plan and its concrete no-rewrite restack proposal before code/history changes. Fetch #279/main/branding again and assess intervening changes.
2. Compare current head to pinned audit head; audit differences and update plan/manifest. Material changes need owner approval; do not silently substitute an incompatible foundation.
3. Confirm clean checkout and unoccupied feature numbers/branches.
4. Preserve F099. With owner approval, merge the verified updated parent into this child through a normal reviewable merge commit, retaining bcb1bee7. Verify new foundation ancestry. Do not rebase, force-push, recreate F099 or write to #279/main.
5. Replace old Android branding in F099, run brand/native and affected web/legal checks, normal-push only the child and open a draft against feature/legal-compliance-and-consent-v1. Verify GitHub base/head.
6. Record exact heads/checks; continue sequentially from each immediate predecessor after its acceptance checks. Leave all PRs open, unmerged.

No routine rebase/merge of completed PRs to main. Cumulative history does not justify cumulative review diff; use the parent/head comparison and PR three-dot diff to verify bounded scope.

### When #279 or a predecessor changes

Stop automatic restacking. Fetch/read changes; report old/new SHAs, changed contracts/migrations/notices, compatibility impact, affected tests and proposed resolutions. Obtain approval for the concrete restack/material plan changes before updating shared child branches.

Preferred no-rewrite option: merge the updated immediate parent **into its child feature branch**, retaining merge commits and conflict resolution for review; normal-push; cascade parent-to-child in order; rerun affected checks; verify ancestry/base/head; update manifest/restack log. This is branch synchronization, not merging a GitHub child PR into its parent, #279 into main, or releasing anything. Do not perform it automatically.

If linear ancestry is required, propose new replacement branches from the new immediate parents with reviewed incremental commits and replacement PRs. Preserve old branches/PR history; no force-push or deletion. Any PR base retargeting is explicit and verified, never a silent main retarget.

Reviews/checks belong to exact heads. Head changes require revalidation and fresh review; prior green CI/owner approval cannot be copied forward as current evidence.

## 13. Rollback and production holds

Planning/engineering rollback: leave branches/PRs open, revert a focused child change with an additive commit, and propagate compatibility deliberately. Do not revert or modify protected #279 or erase shared history.

Runtime rollback, only after separately authorized deployment: retain a grant/withdrawal-aware API and schemas/snapshots. Pre-consent main would ignore new withdrawal evidence and is unsafe after legal data exists. Freeze new enquiries/lead delivery through reviewed controls, preserve masking/withdrawal/history, restore a compatible build, and do not replay suppressed notification jobs. Collection flags off do not authorize disclosure of withdrawn grants.

Do not edit old policy content/versions, disable append-only triggers for convenience, drop migrations/evidence, or fabricate acceptance. Completed deletion cannot be rolled back; test on disposable fixtures and use a separately approved operator process.

Production blockers:

- PR #279 and all mobile PRs need explicit owner merge authorization; review success alone is not permission.
- Terms/Privacy/notices are drafts. Contracting entity/address/grievance/privacy contacts, authority, lawful grounds, retention, vendors/regions and current Indian legal obligations need business/counsel approval.
- Approved immutable non-draft versions/effective dates/approval references and matching registry metadata do not exist yet. Publication/flag activation must be separately authorized; do not make these changes as incidental mobile work.
- Native auth/current-policy transport/idempotency/deletion work and all Android acceptance evidence remain outstanding.
- Existing dealership owner agreement rollout/lead gating must be verified without inferring acceptance from current ACTIVE status.
- Compatible deployed backend and migration/rollback rehearsal must be authorized/verified.
- Live OTP/DLT/provider delivery, physical devices, deletion fulfillment/processors/backups, signing/app links/crash privacy, Play account/testing/access and review remain external gates.

## 14. Effort and release preparation

Tentative engineering estimates after consent reuse:

| Work                               | Days                       |
| ---------------------------------- | -------------------------- |
| Foundation                         | 4–5                        |
| Native auth backend/policy adapter | 5–8                        |
| Native auth/policy UI              | 4–6                        |
| Cars/search/gallery                | 5–7                        |
| Home/dealers                       | 3–4                        |
| Saved/account                      | 2–3                        |
| Consent/enquiries integration      | 2–4                        |
| Support                            | 2–4                        |
| Deletion fulfillment               | 3–6                        |
| Release hardening/QA/builds        | 5–8                        |
| Total                              | **35–55 engineering days** |

Roughly 7–11 working weeks for one experienced engineer; not a guaranteed delivery date. Legal approvals, provider/device/operator access, Google testing/review and owner PR review are separate critical-path dependencies. Reuse removes duplicate work, not mandatory acceptance gates.

Prepare Android-only development/preview APK and production AAB profiles, public environment allowlists, no secrets in bundles/cloud context, owner-controlled signing, approved package (proposed `com.dealersdrive.customer`), PR #311 SVG-derived symbol-only launcher/adaptive/splash/Play icon and independent wordmark on screens/graphics, real release screenshots/store assets, Data safety/privacy/deletion URLs, app access/content rating/ads/permissions declarations, internal/closed testing and staged rollout/incident documentation.

Current SDK/Play policy facts in the original audit must be rechecked before submission. Minimum/target API, 16KB/native library support, organization/personal verification/testing rules, and owner Play account details remain release checks. No production secret/cloud resource creation, backend deployment, legal activation, Google Play upload or publication follows from START.

## 15. Decision log and manifest

| Item                                             | Classification/default                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| #279 open/draft/head/base/checks                 | Confirmed from GitHub                                                      |
| Policies/consent/withdrawal/evidence implemented | Confirmed from pinned source; reuse                                        |
| Legal drafts unapproved                          | Confirmed source/release docs; hold production                             |
| Ten immediate-parent mobile PRs                  | Mandatory workflow; no standalone duplicate policy PR                      |
| Native legal status/permissions/history routes   | Reuse CUSTOMER namespace only                                              |
| Native public current-policy/notice adapter      | Proposed minimal missing capability in Mobile 2                            |
| Support-backed deletion request                  | Confirmed partial coverage; do not claim fulfilled erasure                 |
| Verified deletion fulfillment/retention          | Requires approved operational/legal scope                                  |
| Feature IDs/branch names                         | F099–F108 allocated and open; exact branches/PRs recorded in manifest      |
| CI on feature bases                              | Confirmed workflow gap; address in Mobile 1                                |
| Restacking                                       | Explicit compatibility assessment/review; no automatic rewrite             |
| Native session/library/package/vendor choices    | Original recommended defaults; pinned/validated in approved implementation |
| Production merges/publication/deployment         | Separate explicit owner authorization                                      |

The companion `stack-manifest.json` records the #279/#311 baseline and all ten actual open draft PRs, with each immediate-parent dependency, verified head, checks and evidence. Checkpoint SHAs exclude their later documentation-only commit; refresh GitHub before pinning/restacking.

## 16. Approval gate and expected end state

This amendment retains #279 legal reuse and the ten-PR stack, updates the foundation and mandatory PR #311 branding, and preserves customer/native/security/release scope. Fresh START authorizes the amended implementation and the stated no-rewrite restack; merge, deployment, legal publication and Play submission still require separate authorization.

The owner supplied explicit **START**, authorizing this amended implementation. Green CI and draft legal text do not authorize merges, legal publication, deployment or Play submission; those remain separate gates.

Expected completed engineering state: #279 open/unmerged; every Android PR open/unmerged against its immediate predecessor; all Android commits descend from the verified foundation; reviewed bounded diffs and complete test/evidence manifests; main untouched by Android work; no production deployment, legal publication or Play upload.

**BRANDING AMENDMENT APPROVED — F099 IMPLEMENTATION RESUMED**

**The amendment itself performed no implementation or restack. The subsequent START authorizes implementation and the documented restack. Merging and production release remain separately gated.**

## Resumed F099 implementation record

Explicit START after the branding amendment authorizes the documented parent-into-child merge. Merge fb02d063 preserves bcb1bee7 and incorporates PR #279 head 6180a4b. F099 adopts exact PR #311 native geometry with no extra branding library and retains the ten immediate-parent branch bases. Next configuration explicitly selects the web React JSX type namespace to keep native/web versions isolated. The stack manifest records verified checkpoints rather than impossible self-referential commit SHAs; current GitHub heads/checks must be refreshed before each child is pinned.

F099 draft [PR #312](https://github.com/shashikiran6sk/DealersDrive/pull/312) is based on feature/legal-compliance-and-consent-v1 at 6180a4b. [Validation](f099-validation.md) records successful local checks and actual release limitations. GitHub CI is separate; refresh its exact tested head before creating F100. No PR has been merged.

## F100 native backend implementation checkpoint

F100 descends from PR #312 head ba2f30c5 and preserves the exact immediate-parent base. Native capabilities remain disabled by default (NATIVE_CUSTOMER_AUTH_ENABLED=false). Customer-only bearer excludes workspaces/invitations and all privileged mounts. OTP challenges are purpose-separated HMAC credentials using existing server secrets and shared atomic CachePort counters; no challenge table or new migration. Current-policy JSON reuses the foundation registry/digests/publication metadata and withholds production drafts. Customer/Agreement schemas are extracted unchanged into lean modules so native auth imports do not bundle draft archives. See [native auth design](../code/api/modules/auth/native-auth.md) and [F100 validation](f100-validation.md). Activation, live provider settings and approved legal publication remain external owner gates.

## F101 native UI implementation checkpoint

F101 starts from the verified F100 head 8ec6b2da / draft PR #313; all reported F100 CI/security checks passed. Native phone/OTP/name, secure session lifecycle and policy/profile entry use F100's unchanged API and approved branding. In-memory pending intents bind to an authenticated owner and are never persisted/replayed after process death. No save/enquiry mutation is introduced before F104/F105. See [F101 validation](f101-validation.md) and [session/UX design](../code/mobile/auth.md). The ten immediate-parent bases and separate merge/deployment/release approval gates remain unchanged.

## F102 discovery implementation checkpoint

F102 uses the actual Available/Reserved public contract and 404 for sold/withdrawn detail. Counts distinguish available from pagination totals. Native list/filter/gallery/detail reuse the existing public APIs and updated mobile web geometry. Pure search/title helpers are shared with compatibility re-exports and their original behavior tests. F101 CI repairs are carried forward through normal immediate-parent merges; no history rewrite. See [F102 validation](f102-validation.md) and [discovery design](../code/mobile/cars.md).

## F103 Home/dealer implementation checkpoint

F103 starts from F102 #315 head dab6e7ab. The repaired F101 and F102 now report all GitHub checks successful. Home/discovery and dealer directory/profile/yard/gallery/inventory/directions reuse the actual website sources and public API; conceptual cover is identified explicitly, Maps is user-tapped and no dealer phone/privileged interface is exposed. See [F103 validation](f103-validation.md) and [Home/dealer design](../code/mobile/dealers-home.md).

## F104 implementation checkpoint

F104 starts at the verified F103 head b4357a32 / draft PR #316, whose reported CI checks pass. Native saved controls/list and account agreements reuse existing server records and policy evidence. Optional slug pagination preserves the legacy response and completes native hydration beyond 500 records; no migration or parallel data model. See [saved/account internals](../code/mobile/saved-account.md) and [validation](f104-validation.md). All ten immediate-parent bases, legal publication gates and owner merge/release approvals remain unchanged.

## F105 implementation checkpoint

F105 starts from F104 head 1f0d258d / draft PR #317; its reported checks pass. Native enquiries/history/privacy controls reuse PR #279’s transaction, scoped grants and withdrawal evidence. No mobile policy model or new migration. See [validation](f105-validation.md) and [internals](../code/mobile/enquiries.md). Uncertain enquiry delivery has no automatic retry. The ten immediate-parent bases remain unchanged. Account-deletion fulfilment/retention needs an approved operational procedure; a support request alone is not completed erasure and remains a launch blocker.

## F106 implementation and F107 approved amendment

F106 starts from F105 head 1b310ecc / draft PR #318, whose GitHub checks pass. Native support uses existing conversations/quota/reopen contracts, with one additive nullable create-retry migration. See [validation](f106-validation.md) and [internals](../code/mobile/support.md). On 15 October the owner approved both separate customer deactivation/reactivation and deletion-request controls on Android and web in F107. The [amendment](account-controls-amendment.md) defines fresh OTP, customer-only state/session revocation, withdrawal preservation and multi-role protection. The ten-PR stack remains unchanged; no legal fulfilment/retention or production approval is inferred.

## F107 account controls checkpoint

F107 descends from F106 draft #319 at 18245c5c; its GitHub checks pass. The owner-approved amendment adds separate native/web fresh-OTP customer-only deactivation/reactivation and support-backed deletion requests, plus a public external request resource. Existing legal withdrawal/evidence and identity services remain authoritative; dealer/admin roles are preserved. One additive migration supplies customer-only state and authentication recency. See [validation](f107-validation.md), [internals](../code/mobile/account-controls.md) and the [unapproved fulfilment runbook](deletion-fulfilment-runbook.md). Deletion intake is not erasure; release remains blocked on verified fulfilment/retention and external acceptance gates. All ten immediate-parent PR bases and production approval boundaries remain unchanged.

## F108 release-hardening checkpoint

F108 draft [#321](https://github.com/shashikiran6sk/DealersDrive/pull/321) targets F107 #320 at 9a774251. All ten immediate-parent drafts and #279 report combined checks SUCCESS at the 15 October handoff checkpoint, with no merges. At e0874e6a, full CI passes 5,998 tests, security checks pass, and native validation compiles APK/AAB, inspects manifest/ELF/ZIP and passes 2/2 API35 guest/link flows. Earlier failures are retained in validation history. This does not prove the intermediate startup-window link loss resolved or satisfy Android16/physical/authenticated release acceptance.

See [validation](f108-validation.md), [acceptance matrix](acceptance-tests.md), [security findings](security-review.md), [build/incident operations](release-operations.md), [Play checklist](play-checklist.md) and [production acceptance](production-acceptance.md). Real-device/installed E2E, live OTP, deletion fulfilment, approved policies, residual security findings, performance and production signing/Console approval remain blockers. No merge, deployment, legal activation or Play upload is authorized or performed.

## Review handoff and owner testing

Use the [complete agent handoff](AGENT-HANDOFF.md) with the owner's findings and requested fixes/enhancements. It records exact PR heads/bases, code/API/migration boundaries, latest passing evidence and unresolved risks, plus a copyable next-agent instruction and test-finding template. The [macOS multi-environment runbook](running-android/README.md) covers Android Studio, Docker/host API, AWS-connected release mode and physical phones. Latest remote application CI is e0874e6a; later local documentation commits do not imply a new GitHub run. Production remains **NO-GO — LAUNCH BLOCKED**.
