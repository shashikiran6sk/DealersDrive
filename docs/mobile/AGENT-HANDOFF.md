# Dealers-Drive Android — review and continuation handoff

Prepared **15 October 2026** for the owner and the next reviewing/implementation agent. Attach the owner's testing findings and requested fixes/enhancements to this document. This handoff is intended to be usable without the earlier conversation; source and freshly verified remote state take precedence over older checkpoint prose.

## 1. Outcome and authorization boundaries

The customer-only React Native/Expo Android implementation exists as **ten draft PRs, all open and unmerged**, stacked above legal/consent PR #279. Every PR targets its immediate predecessor. All eleven PRs, including the foundation, report combined GitHub checks **SUCCESS** at the verified remote heads below. This is an implementation/review checkpoint, **not production acceptance**.

**Release verdict: NO-GO — LAUNCH BLOCKED.** Full local/staging customer acceptance, real OTP, physical Android/Android16, security review, approved legal publication, deletion fulfilment and production signing/Console gates remain incomplete. There is also an unresolved startup-window link-delivery finding described below.

Owner authorizations and constraints that carry forward:

- Implementation START was received. Do not repeat the entire Phase 1 audit or require another START for already authorized in-scope implementation work. The owner is now testing and supplying observations/requested fixes for review.
- Customer-only Android v1. Preserve existing website, dealer, sales and admin behavior. No privileged native screens or bearer access to those roles.
- Reuse Express/PostgreSQL/Prisma, existing User identities, shared schemas and PR #279's authoritative legal/evidence/consent services. No new identity silo, database or parallel consent rules.
- Use PR #311's exact approved black/white DD symbol and separate DealersDrive wordmark geometry. No logo redesign or duplicate branding PR.
- F107 explicitly includes **both** customer deactivation/reactivation and a separate deletion-request path on Android **and web**. Actual erasure/retention is not approved or implemented.
- Keep PR #279 and all mobile PRs open/unmerged. Do not change PR #279, force-push, rewrite history, delete predecessor branches or push directly to main.
- No production migration/deployment, policy publication, native-auth activation, MSG91-setting change, cloud/signing-resource creation or Play upload without separate explicit owner authorization.
- Run CI concurrently with independent work. The owner prefers continuing while its 7–10 minute checks run, then returning to failures. Native compilation can take longer. Do not call a pending or failed check passed.
- The current request authorizes committing the runbook and handoff locally. These documentation commits are not a push, merge or release instruction.

## 2. Verified Git baseline and documentation commits

| Item                               | Verified value                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Repository                         | `https://github.com/shashikiran6sk/DealersDrive`                                                                    |
| Mac checkout                       | `/Users/shashikiran/Development/dealers-drive`                                                                      |
| Current working branch             | `feat/f108-mobile-release-hardening`                                                                                |
| Remote application/test checkpoint | `e0874e6a37f762d3dc5685c70063ef447e81c63d`                                                                          |
| Main                               | `a969dc2c5223ddb04c23d720ded6a4daccfe33ab`                                                                          |
| Legal foundation                   | `6180a4b52522493b884550448d0a84e7d95432df`                                                                          |
| Branding                           | PR #311 merged at main's `a969dc2`; included by the legal foundation                                                |
| Environment runbook commit         | `cfd48bfba44fc646624148c80b3ab3994bf1326f`, documentation only, local descendant of e0874e6a                        |
| This handoff/status refresh        | Subsequent documentation-only commit; get its exact SHA from `git log`, avoiding a self-referential SHA in the file |

The tested remote code and local documentation heads are intentionally distinguished. CI at e0874e6a does not mean a later local documentation commit ran in GitHub. At handoff preparation, the remote F108 head was still e0874e6a. Preserve the owner's files and check status before any checkout, commit or push.

## 3. Exact PR stack

All rows below were verified **OPEN / DRAFT / combined checks SUCCESS** on 15 October 2026. SHAs are full source heads; refresh GitHub before relying on them in a later session.

| Feature / PR                                                          | Head branch                               | GitHub base branch                        | Verified head SHA                          |
| --------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| [Legal #279](https://github.com/shashikiran6sk/DealersDrive/pull/279) | `feature/legal-compliance-and-consent-v1` | `main`                                    | `6180a4b52522493b884550448d0a84e7d95432df` |
| [F099 #312](https://github.com/shashikiran6sk/DealersDrive/pull/312)  | `feat/f099-mobile-foundation`             | `feature/legal-compliance-and-consent-v1` | `ba2f30c5633833dbece9a9c099a34004bb2e1a8d` |
| [F100 #313](https://github.com/shashikiran6sk/DealersDrive/pull/313)  | `feat/f100-mobile-auth-backend`           | `feat/f099-mobile-foundation`             | `8ec6b2da319166bd5dde01917daec541158dc454` |
| [F101 #314](https://github.com/shashikiran6sk/DealersDrive/pull/314)  | `feat/f101-mobile-auth-ui`                | `feat/f100-mobile-auth-backend`           | `7046f5436ac6a3b4c827d6c53b3bed38815fc41f` |
| [F102 #315](https://github.com/shashikiran6sk/DealersDrive/pull/315)  | `feat/f102-mobile-cars-search-gallery`    | `feat/f101-mobile-auth-ui`                | `dab6e7ab745e54703e83e532f24eeca1ded5bd23` |
| [F103 #316](https://github.com/shashikiran6sk/DealersDrive/pull/316)  | `feat/f103-mobile-home-dealers`           | `feat/f102-mobile-cars-search-gallery`    | `b4357a32c49b3ac0285cd9b1521672ab48fff527` |
| [F104 #317](https://github.com/shashikiran6sk/DealersDrive/pull/317)  | `feat/f104-mobile-saved-account`          | `feat/f103-mobile-home-dealers`           | `1f0d258db5b84fe09981aba7ce04ef9af1be2694` |
| [F105 #318](https://github.com/shashikiran6sk/DealersDrive/pull/318)  | `feat/f105-mobile-consent-enquiries`      | `feat/f104-mobile-saved-account`          | `1b310ecc1629604d8cd33163b1d3db2cb37b8fed` |
| [F106 #319](https://github.com/shashikiran6sk/DealersDrive/pull/319)  | `feat/f106-mobile-support`                | `feat/f105-mobile-consent-enquiries`      | `18245c5c77032d85babd69feb15371abc35ea998` |
| [F107 #320](https://github.com/shashikiran6sk/DealersDrive/pull/320)  | `feat/f107-mobile-account-deletion`       | `feat/f106-mobile-support`                | `9a774251f950f00c4d5204523650c1328158400e` |
| [F108 #321](https://github.com/shashikiran6sk/DealersDrive/pull/321)  | `feat/f108-mobile-release-hardening`      | `feat/f107-mobile-account-deletion`       | `e0874e6a37f762d3dc5685c70063ef447e81c63d` |

Review incremental diffs against each immediate parent, not the cumulative main-to-F108 diff alone. Existing CI repairs propagated with normal parent-into-child merges, without rewritten history. Do not automatically rebase the stack if main/foundation moves. First assess compatibility, document a reviewable restacking proposal and obtain the required authorization. Preserve legal migrations/evidence and existing branch heads.

For contained release-hardening bug fixes, add focused normal commits on the current F108 branch when within its scope. Do not silently relocate fixes into predecessor PRs or create an unapproved extra feature stack. If an enhancement materially changes approved scope/architecture or review placement requires changing earlier PRs, explain the proposed scope/stack changes first.

## 4. Read these files first

1. Root [AGENTS.md](../../AGENTS.md) and [CLAUDE.md](../../CLAUDE.md). The repository has strict schemas, server-module boundaries, OpenAPI parity, constants/component structure and source-comment rules. Owner-approved mobile/stack instructions supersede historical reconstruction-only assumptions and the old per-PR stop instruction.
2. [Architecture/audit plan](README.md), [stack manifest](stack-manifest.json), this handoff and the owner's attached findings.
3. [Multi-environment runbook](running-android/README.md) before running local services or Android Studio.
4. [Acceptance matrix](acceptance-tests.md), [production acceptance](production-acceptance.md), [security review](security-review.md), [release operations](release-operations.md), [Play checklist](play-checklist.md).
5. [Account-controls amendment](account-controls-amendment.md) and [unapproved deletion fulfilment runbook](deletion-fulfilment-runbook.md).
6. Feature validation files `f099-validation.md` through `f108-validation.md` and [native code rationale](../code/mobile/README.md).

Installed Turborepo is 2.11.7. Read its bundled `docs/README.md` and relevant pages before changing tasks/flags; do not assume another version's semantics. This is a pnpm workspace, not an independent mobile repository. No new dependency install or full build is necessary just to read/review the handoff.

## 5. Implemented scope and code map

| Area              | Current implementation / review entry points                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation        | `apps/mobile`, pinned Expo SDK 57.0.29, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3; Expo Router, TanStack Query, SecureStore, Expo Image; workspace integration, boundaries, native fixtures                           |
| Branding          | Four byte-identical SVG masters from `apps/web/public/brand`; native copies/derived images in `apps/mobile/src/assets/brand`; `apps/mobile/scripts/brand-assets.mjs` verifies geometry, hashes, pixels and icon safe zones      |
| Navigation        | `apps/mobile/app`: Home/Explore/Saved/Profile tabs, car/dealer details, galleries, enquiries, support, policies, About/account; `app/+native-intent.tsx` and `src/features/navigation/incoming-link.ts` validate incoming links |
| Auth backend      | `apps/api/src/modules/auth/native-auth.service.ts`, `routes/native`, `native-otp-challenge.ts`, customer identity/session resolver; existing MSG91 verification, User and CUSTOMER sessions                                     |
| Auth native       | `src/features/auth`: `session-manager.ts`, `credential-storage.ts`, `pending-action.ts`, provider, sign-in and policy screens; phone/OTP/name, restoration/logout, generic errors and explicit reactivation                     |
| Cars              | `src/features/cars`, shared native car/gallery components; list/search/suggestions/filter state, detail, similar inventory, unavailable/error states; existing public REST                                                      |
| Home/dealers      | `src/features/home` / `dealers`; public config, directory/search, profile/yard imagery/inventory and external directions; source web geometry and approved branding                                                             |
| Saved/account     | `src/features/saved` / `account`; server-owned save/unsave/list, full paged slug hydration, account agreements/history, customer status and controls                                                                            |
| Enquiries/consent | `src/features/enquiries`; existing backend `enquiries` and `legal` modules; scoped sharing status/grants/withdrawal, explicit enquiry form/history, no automatic uncertain mutation retry                                       |
| Support           | `src/features/support`; existing `apps/api/src/modules/support`; tickets, conversation/replies/reopen, active polling and server quota, stable UUID request retry identity                                                      |
| Account controls  | API `customer-account.service.ts`, `customer-access.ts`, fresh-OTP/reactivation services; native account/deletion screens; web `/account`, `/account-deletion` and existing auth continuation                                   |
| Reliability       | `src/services/api`: strict parsed responses, origin-bound credential transport, bounded requests/cancellation; `src/features/reliability`: generic error boundary and About/version                                             |
| Build/release     | `apps/mobile/config/build-config.cjs`, `app.config.ts`, `eas.json`, scripts and `.github/workflows/android.yml`; validation signing only; draft store assets/listing                                                            |

Paths beginning `src/` in the table are under `apps/mobile`. Domain rationale and deliberate divergences are documented under `docs/code/mobile` and `docs/code/api`. The existing web sandbox uses DOM components; native components have React Native Testing Library fixtures instead. New web account controls have Storybook entries. Visual signoff remains a separate task.

No WebView marketplace wrapper, dealer/admin native screens, push/Firebase integration, paid map SDK, independent refresh-token system or iOS implementation was added. Google customer login was not added: the audited Google flow belongs to dealer/account workflows; do not grant privileged OAuth capability by treating it as customer-only sign-in.

## 6. API and shared-contract guide

Use shared strict Zod DTOs and existing routes. Full request/response/error details remain in the source OpenAPI modules and audit plan; do not create replacement endpoints based on this abbreviated map.

| Capability              | Existing routes consumed by Android                                                                                                                           | Source / contracts                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Cars/search             | `GET /v1/vehicles`, `/vehicles/:slug`, `/vehicles/:slug/similar`, `/search/vehicles`, `/locations`                                                            | `src/features/cars/cars-api.ts`; contracts `public`, `vehicle-search`                                                        |
| Dealers/Home            | `GET /v1/dealers`, `/dealers/:slug`, `/dealers/:slug/vehicles`, `/search/dealers`, `/config/public`                                                           | `src/features/dealers/dealers-api.ts`; existing public contracts                                                             |
| Native auth             | `POST /v1/auth/native/customer/otp`, `/otp/resend`, `/otp/verify`, `/sign-up`, `/reactivate`; `GET /me`; `POST /logout` under the same native customer prefix | `src/features/auth/auth-api.ts`; contracts `native-auth`, `customer-auth`                                                    |
| Public policies         | `GET /v1/legal/publication`                                                                                                                                   | Existing legal registry/publication/evidence; contracts `legal-client`                                                       |
| Account                 | `GET /v1/auth/customer/account`; `POST /v1/auth/customer/account/deactivate`; native reactivation above                                                       | `src/features/account/account-api.ts`; contracts `customer-account`                                                          |
| Agreements              | `GET /v1/legal/customer/status`, `/history`; `POST /v1/legal/customer/terms`                                                                                  | `src/features/saved/saved-api.ts`; same website policy/evidence rules                                                        |
| Saved                   | `GET /v1/saved-vehicles`, `/saved-vehicles/slugs`; `PUT` / `DELETE /v1/saved-vehicles/:slug`                                                                  | Same server records/customer; optional slug pagination preserves legacy response                                             |
| Enquiries/sharing       | `GET /v1/enquiries/sharing-status`; `POST` / `GET /v1/enquiries`; `GET /v1/enquiries/:id`; sharing-permissions list and explicit withdrawal endpoints         | `src/features/enquiries/enquiries-api.ts`; contracts `enquiry-client`, existing legal module                                 |
| Support/deletion intake | `GET` / `POST /v1/support/tickets`; `GET /tickets/:id`, `POST /tickets/:id/messages`, `/tickets/:id/reopen` under support prefix                              | `src/features/support/support-api.ts`; contracts `support-client`; deletion is a separate intake purpose, not an erasure API |

Native bearer authorization is explicitly limited to customer routes. Cookies/CSRF/role checks for existing web/dealer/admin paths are preserved. Treat the device as untrusted; never broaden the bearer allowlist to solve an unrelated permission error. DTOs/schemas/pure constants can be shared; Prisma, secrets, server authorization internals and Next modules cannot be imported into the Android bundle.

## 7. Business/security invariants to preserve

- **Identity:** website and native share existing canonical Users/account-linking rules. No duplicate user creation or trusting client-supplied customer/dealer ownership. Account collision/merge/deactivation must remain transactionally consistent.
- **Sessions:** opaque 30-day existing CUSTOMER sessions, hashed server-side; credentials stored in SecureStore, not AsyncStorage/logs/URLs. No refresh tokens were invented. Expiry/revocation/private-cache clearing remain authoritative. Old sessions without fresh OTP proof cannot deactivate an account.
- **OTP:** server-side MSG91 only, purpose-bound HMAC challenge, replay protection/shared counters, rate/cooldown/attempt limits and fail-closed cache behavior. Native capability defaults off. Fake OTP 123456 is strictly local; production refuses fake providers. Never log challenges, proofs or OTPs.
- **Pending actions:** process-local, one-use and owner-bound. Saving resumes at most once after authentication. Enquiry context resumes, but explicit consent/confirmation is still required before sending. Process death/cancel/account switch must not replay a mutation.
- **Saved:** server truth across platforms; no duplicate save records; removed/unpublished handling; partial/failed requests cannot falsely report success. Full saved-state hydration pages beyond 500 slugs without breaking queryless legacy callers.
- **Legal:** policy acknowledgment is distinct from explicit dealership contact-sharing permission. Backend scopes each valid grant to the correct dealer/version/evidence. Same-dealer reuse follows the existing rules; another dealer needs separate consent. Withdrawal is immutable, does not recall delivered copies and is never undone by reactivation.
- **Enquiries:** listing/dealer association is server-derived, availability/recipient rechecked transactionally, uncertain submission has no silent retry. Dealer visibility remains in existing authorized workflows.
- **Support:** customer-owned tickets/messages, quota and closed/reopen rules remain server enforced; request UUID and payload digest prevent unintended create duplication. No attachment or push capability was invented.
- **Deactivation:** fresh OTP + affirmative confirmation; customer-only flag, revoke CUSTOMER sessions and withdraw future sharing atomically. Do not suspend/delete the shared User or disturb dealer/admin roles/sessions. Explicit OTP reactivation preserves prior withdrawals.
- **Deletion:** visible native/web request intake plus public external resource. Actual disposition/retention/operator verification remains unapproved; no blind cascade delete or immutable-evidence bypass.
- **Errors/telemetry:** server success before final mutation success UI, sanitized errors/request IDs, bounded requests (8-second standard API bound; auth separately bounded), no sensitive request bodies/credentials. No new analytics/crash/notification SDK was added.

## 8. Database and rollout dependencies

PR #279's migrations/legal records remain the foundation. Android added only these two migrations relative to it:

| PR   | Migration                              | Change                                                                                                 |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| F106 | `20261015100000_support_create_retry`  | Nullable ticket `clientRequestId` UUID / `requestDigest`; unique `(customerId, clientRequestId)` index |
| F107 | `20261015110000_customer_deactivation` | Nullable User `customerDeactivatedAt` and Session `authenticatedAt`                                    |

F100 native challenge/counters use existing services and require no new table. F104 saved pagination and F105 native consent integration add no migration. F108 adds no migration.

Apply migrations only to the intended local/disposable environment when following the runbook; production rollout is not authorized. For a future approved deployment, additive migrations must precede dependent backend code. Old code may ignore `customerDeactivatedAt`: blindly rolling back to it can reopen customer access. Do not drop fields, restore revoked sessions or reverse withdrawal evidence during rollback. Feature-flag native issuance off if an approved incident response requires it; preserve customer-access/consent enforcement for existing records. Database restore/retention needs its own reviewed procedure.

## 9. How the owner is testing

The committed [macOS runbook](running-android/README.md) is the command source; do not recreate instructions from memory.

1. **Local full stack:** Compose app profile plus explicit API override enables native auth and local draft legal enforcement; fake OTP 123456. ADB reverse 4000/3000/8081 lets existing localhost media/policy URLs work in the emulator. Synthetic seed has no vehicle photographs. Root `.env` alone does not forward the native/legal flags into Compose.
2. **Release-mode AWS browsing:** `EXPO_PUBLIC_APP_ENV=preview`, AWS API / authoritative HTTPS website origins, `expo run:android --variant release`. No Metro/runtime Docker needed; package remains `.preview`, with validation signing. This is not the actual production publishing profile.
3. **Other options:** host API with Docker backing services; USB physical Android; a compatible, separately authorized staging backend; existing CI artifact for shell-only tests.

Read-only AWS probes on 15 October returned readiness 200 at main `a969dc2` and legal-publication **404**. That deployed revision lacks this unmerged native/legal stack. Native login/new account controls and compatible authenticated operations are not verified there. An AWS-connected app URL is not a backend deployment. Record backend version and environment with every finding; do not dismiss an actual app error-state bug merely because an endpoint is undeployed.

Current CI APK origins are deliberately `.invalid`: it cannot validate live inventory/authentication. Public origins are bundled; installed release binaries do not adopt later shell/Metro setting changes. Local HTTP is for debug builds; release manifests disallow cleartext. Production identity/signing/App Links settings remain deliberately gated/unfinalized.

## 10. Executed validation and exact evidence

Latest application checkpoint **e0874e6a**:

| Check                      | Result / source                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full CI                    | [Run 38702174595](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38702174595), SUCCESS: lint, types, builds and tests                                                 |
| API                        | **3,516 tests**, 181 files, in that full CI run                                                                                                                                    |
| Website                    | **1,737 tests**, 146 files                                                                                                                                                         |
| Contracts                  | **599 tests**, 29 files                                                                                                                                                            |
| Native                     | **146 tests**, 24 suites                                                                                                                                                           |
| Total above                | **5,998 tests**; smoke flows/Python checks are separate, not additional copies of the same tests                                                                                   |
| Static/security            | [Run 38702174535](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38702174535), Semgrep and gitleaks SUCCESS; CI dependency gate SUCCESS does not mean zero advisories |
| APK/AAB + manifest/ELF/ZIP | [Run 38702174641](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38702174641), SUCCESS, generated validation signing, arm64/x86_64; min API24, target/compile36       |
| Emulator                   | API35 AOSP, Pixel5 profile, x86_64, 1080×2340 at 440dpi; `guest` 18s and `public-links` 13s, **2/2 flows pass**, no ANR since boot in captured diagnostic                          |
| Expo compatibility         | Earlier local Expo Doctor **21/21 PASS** and export/boundary/branding checks; not a device benchmark                                                                               |
| Build validator            | Four adversarial Python checks, hash-pinned defusedxml; permissions, XML entities and ELF tests. ZIP alignment checked separately by Android build tools                           |
| API container              | Earlier final local API runner build/import smoke passed, including network-disabled imports; not a deployment or running AWS validation                                           |

Artifacts at the successful native run: UI **11957660993**, binaries **11957566366**. Artifacts have limited retention; repository evidence below preserves selected unmodified screenshots/JUnit with source/run/hash provenance. Screens validate guest/route/error rendering only. The car screenshot is a network-error view at a known missing validation slug, not a successful loaded car. No physical device, live SMS, live Google auth, actual erasure, performance or signed-production build result is claimed.

See [preserved native evidence](../screens/mobile/f108/README.md). The newly committed documentation received formatting, link, shell-syntax and example-configuration checks, not a new application GitHub run. Refresh exact-head evidence if code changes.

## 11. Failure history and unresolved review findings

Retain these distinctions rather than rewriting earlier failures as passes:

| ID  | Finding / current disposition                                                                                                                                                                                                                                                                                                                                             | Review requirement                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 | **Startup-gap link loss remains unverified.** On app source 4ec654d4, VIEW arrived before ReactNativeJS initialization and screen stayed Home. e0874e6a changes only the smoke timing and validation docs: warm entry now waits for Home, and cold entry starts a stopped app. Both pass, but no application-code correction of the intermediate startup window was made. | Reproduce a main launch immediately followed by VIEW before JS/listeners are ready; add a meaningful regression and fix actual delivery if reproduced. Do not claim all startup races resolved from 2/2 smoke. Preserve origin/path/token/refusal rules. |
| R02 | API36 CI images produced System UI/Quickstep ANRs; API35 clean smoke passes.                                                                                                                                                                                                                                                                                              | Complete Android16 and 16KB page-size **runtime** validation. ELF/ZIP inspection is not a page-size device run. Do not suppress system dialogs and call that passing.                                                                                    |
| R03 | Full customer flows have fixtures/integration tests but no complete installed local/staging/physical acceptance.                                                                                                                                                                                                                                                          | Execute owner findings against the correct environment, including real inventory/gallery data, keyboard/Back/TalkBack, sessions, mutations and cross-platform behavior.                                                                                  |
| R04 | Screenshot of missing-slug/network error retains a “Loading cars…” heading while the error/retry controls are visible.                                                                                                                                                                                                                                                    | Review error-state wording/layout under real slow/offline/404 scenarios; this is a UI observation, not proof of wrong backend data or a loaded vehicle.                                                                                                  |
| R05 | Browser visual review of new web controls was blocked by automatic approval review because Chrome's profile picker exposed unrelated account identifiers. Storybook entries/builds exist; visual approval is not claimed.                                                                                                                                                 | Use an authorized privacy-safe browser session; do not bypass the rejected action or fabricate visual signoff.                                                                                                                                           |

Older native runs: 38679375097 compiled and passed guest but failed links; 38682124954 had System UI ANR; 38697170490 had Quickstep ANR; 38699246274 had a clean guest pass but startup-gap link failure. F108 validation preserves chronology. Installed React Native URL behavior and Router extraction have regression coverage; that does not cover every event-delivery race.

## 12. Release blockers and decision owners

| Blocker                              | Required evidence / owner                                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deletion fulfilment                  | Owner/privacy adviser approval of operator, verification, record/retention matrix, shared-role handling, processors/backups, actual disposition implementation and completion evidence. Intake/deactivation is insufficient. |
| Legal production publication         | Exact authoritative documents/business facts/versions approved; approved metadata and live public/legal/deletion resources. No drafts silently published.                                                                    |
| Live native OTP                      | Authorized nonproduction/live MSG91 standard server flow, DLT/template/account restrictions, failure categories and rate controls; no keys or provider changes in mobile.                                                    |
| Residual dependency risk             | Snapshot: **0 critical / 3 high / 3 moderate**. Review/remediate actual reachability; no exception approved. Details/advisories in security-review.md.                                                                       |
| Runtime navigation/device acceptance | Resolve/review R01; API36/16KB runtime, physical budget/mid-range devices, lifecycle/keyboard/TalkBack and installed authentication/consent/isolation tests.                                                                 |
| Performance/observability            | Measure release startup, lists/images/search/details, memory/jank/network failures; verify crash/ANR monitoring ownership. Targets in acceptance matrix are unmeasured proposals.                                            |
| Production build/Play                | Owner-finalized package, signing/Play certificate, App Links association, production AAB inspection, Console identity/testing/access/Data safety/deletion declarations/store assets and explicit submission approval.        |

Remaining high advisories were node-forge, braces and deepmerge-ts; tooling/bundle reachability is documented, not a blanket waiver. Moderate decode-uri-component is present through Router/query-string; blindly forcing its ESM fixed release breaks a callable CJS consumer. Other moderate tooling paths include uuid and sprintf-js. Rerun the audit before release rather than treating this dated count as permanent. Do not lower CI gates or force untested major upgrades to make a dashboard green.

## 13. Reviewing and implementing owner findings

1. Read the attached findings; establish tested Git SHA, backend revision, app environment/build variant and device first. Reproduce on local/staging data where possible.
2. Triage each item as confirmed defect, setup/backend mismatch, unverified observation or enhancement. Link the exact source/contract and existing acceptance case. Do not automatically convert observations into authorization for a redesign.
3. Prioritize account isolation/consent/session/data-loss issues, then launch-critical functional failures, then UX/performance, then approved enhancements. A passing mocked test does not refute an installed failure.
4. Implement requested in-scope corrections in small reviewable commits, preserving compatible APIs, website behavior, ownership and branding. Add regression tests that reproduce the failure. Material architecture/scope changes need an explicit amendment; routine implementation details do not require repeated approval.
5. For backend routes: strict contracts, authorization/resource isolation, OpenAPI and backward-compatibility/regression checks in the same change. For schema changes: justify necessity, additive migration and local compatibility evidence; no production migration.
6. For UI: reproduce the current web reference, use existing primitives/constants, native fixtures, screenshots and actual Android navigation evidence. Do not substitute web renderings for native screenshots.
7. Run relevant checks and then the impacted existing regressions. API tests need `TZ=UTC`, matching CI. Initial local historical failures due to host timezone/generated Prisma peer path were corrected; do not alter fixtures or skip checks to conceal environment failures.
8. If pushing is authorized in the active task, push normally to the intended feature branch, verify GitHub head/base and monitor checks while doing independent work. A local commit alone has no new GitHub result. No auto-merge/rebase/production action.
9. Update handoff/manifest/validation at a dated checkpoint. Report what changed, exact tested head, tests actually run, screenshots/device, CI, remaining failures and rollback implications. Preserve unresolved owner findings rather than silently dropping them.

Suggested review checks include customer bearer rejection on dealer/admin/workspace routes; cross-customer saves/support/enquiries; duplicate tap/network-loss handling; account merges during deactivation; fresh OTP recency/session revocation; no sharing restoration; same/different-dealer consent; support UUID/payload conflict/quota; interrupted auth/background/process death; policy version changes and unavailable inventory. Follow the [acceptance matrix](acceptance-tests.md) rather than treating this list as exhaustive.

## 14. Owner test findings template

Copy this section into your attached findings file and repeat the individual finding block for each issue. Never include real OTPs/tokens or unnecessary customer personal data.

```text
TEST SESSION
Date/operator:
Git commit / APK filename or artifact ID:
App version / package (.dev or .preview):
Build variant (debug/release) and EXPO_PUBLIC_APP_ENV:
API origin + /health/ready version:
Local Docker / host API / AWS / staging:
Emulator/device model + Android/API + CPU architecture:
Network / font scale / navigation mode:
Fresh install or upgrade; signed-out or synthetic test user:
Seed/photo fixtures and relevant non-sensitive test setup:

FINDING DD-MOB-001
Title:
Type: defect / enhancement / question / setup
Suggested severity and business impact:
Screen/route and starting state:
Steps to reproduce (numbered):
Expected behavior:
Actual behavior:
Frequency (always / intermittent; sample count):
Screenshot/video filename + timestamp:
Sanitized error/status/request ID:
Website comparison, if relevant:
Requested fix/enhancement:
Acceptance criteria:
Any constraint or preferred behavior:
```

Suggested tracking table for the agent:

| Finding ID | Reproduced / environment | Root cause + source | Priority / approved scope | Commit / PR | Regression + device evidence | Owner retest / status |
| ---------- | ------------------------ | ------------------- | ------------------------- | ----------- | ---------------------------- | --------------------- |
| DD-MOB-001 | Pending owner attachment | Pending             | Pending triage            | —           | —                            | Open                  |

Use P0 for critical isolation/data-loss/outage, P1 for launch-critical failures, P2 for normal functional/UX defects and P3 for polish/optional enhancements. Confirm severity from impact; do not mark an item resolved solely because code was changed. Keep owner retest distinct from automated verification.

## 15. Copyable instruction for the next agent

> Review the Dealers-Drive Android stack using docs/mobile/AGENT-HANDOFF.md and the attached owner findings. First inspect actual Git status, current PR heads/bases and the relevant source. Preserve the ten immediate-parent draft PRs above legal PR #279 and approved PR #311 branding. Summarize verified defects, environment mismatches, unresolved risks and requested enhancements; reproduce and address the owner's requested in-scope corrections with meaningful regression and Android evidence. Prioritize the startup-window link finding and release blockers without treating green smoke as full production acceptance. Reuse existing identity, APIs and authoritative legal/consent services; preserve website and privileged-role behavior. Follow repository instructions, keep changes reviewable and report exact commits/checks/device results honestly. Do not merge, rewrite shared history, publish policies, deploy, migrate production, create signing/cloud resources or upload to Play without separate authorization. Return a findings-to-fix matrix, validation results and updated NO-GO/GO evidence; do not promise release or erasure without verified prerequisites.

Attach this file, the owner's findings and the [environment runbook](running-android/README.md) together. Refer to the [production acceptance report](production-acceptance.md) for the formal verdict. Further documentation-only commits do not themselves close any release blocker.
