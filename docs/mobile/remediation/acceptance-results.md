# Android remediation acceptance evidence

This report records what was tested and what remains a launch gate. The original [timestamped audit and approved plan](audit-and-approved-plan.md) remains the before reference. UI attractiveness, unit success and emulator success are separate kinds of evidence.

## Environments and scope

- Local native builds use release variants, validation signing, arm64, compile/target SDK 36, and a read-only Pixel 8 API 37 emulator. These are optimized bundles, not Expo development-mode performance claims.
- Public preview reads actual production inventory/config/locations/images only. No production customer mutations, SMS, policy publication, deployment or Play upload were performed.
- Authenticated journeys use the existing localhost Docker API with inspected `APP_ENV=local`, `NODE_ENV=development`, native auth enabled, fake OTP and console email. Two dedicated local QA identities were created. Existing local development inventory was used; no inventory/photos/counts were inserted to populate screenshots. Files ending `local` show this isolated test environment, not live marketplace inventory.
- F111 exact-head Android 15/API35 CI evidence is retained separately under `evidence/f112/f111-api35`: two guest/public-link flows passed, no recorded ANR. F112 adds the new startup-window flow and five-tab/Sort/Filters guest checks; its own CI result is recorded in the PR after execution.

## Required automated coverage

| Requirement                                                      | Evidence                                                                                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty Home, complete empty market, partial failure/loading       | `home-discovery.test.tsx`; independent sections and bounded reserved-first teaser requests                                                                    |
| Search/select-only/no submit/stale cancellation                  | `search-suggestions.test.tsx`; canonical brand/model/variant mapping and immediate stale-row hiding                                                           |
| Shared location, hydration and explicit incoming routes          | `location-store`, `navigation-location`, `native-intent` tests                                                                                                |
| Dependent towns, removal/count/filter consistency                | `car-filters`, `dealer-directory-state`, `discovery-controls` tests                                                                                           |
| Separate Sort/Filters                                            | `discovery-controls`; native screenshots and expanded guest smoke                                                                                             |
| Black hearts, optimistic rollback, synchronization/repeated taps | `cars-components`, `saved-provider`, `saved-cache` tests                                                                                                      |
| Five tabs and public-only Dealers                                | `navigation-location`; native width matrix and guest smoke                                                                                                    |
| Dealer inventory and directory filtering                         | `dealers`, `dealer-directory-state`, `discovery-controls` tests                                                                                               |
| Separate policies, versioned choices, recipient/withdrawal       | `policy-choice`, `sign-in-screen`, `enquiry-input`, `enquiry-screen`, `withdraw-button` tests                                                                 |
| API-supported issue selection and required validation            | `support-create` tests and native selector/submission                                                                                                         |
| Shared card/image/status variations                              | four component snapshots plus `cars-components` image-reuse and Save touch isolation                                                                          |
| Modal/system Back and meaningful drafts                          | `selection-sheet`, `navigation-discard`, `sign-in-screen`; native Back/discard/search checks                                                                  |
| Guest/auth/foreground transitions                                | `session-manager`, `saved-provider`, account/enquiry/support form tests and two-account local native journey                                                  |
| No previous-account private state                                | `private-customer-cache` cancels/removes private queries and mutations; `saved-provider` rejects late results and hides old membership; native account switch |

No web, API or shared-contract product code is changed by remediation. Exact-head repository CI covers the existing web/API regressions in addition to mobile checks; source-level success is not installed-device acceptance.

## Native journeys observed

| Journey                                                              | Result and evidence                                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home → suggestion → canonical Cars results                           | Public API, actual keyboard-open selection, Done/outside dismissal in F110; search Back/no applied draft in `search-open-local` and `search-back-local`                         |
| Cars → Save → Saved → detail                                         | Dedicated QA identity; solid black heart and same saved car in `saved-heart-local`, `saved-list-local`                                                                          |
| Guest detail Save → fake OTP → separate signup choices → same detail | Second QA identity returns to the requested Wagon R with solid Saved control: `save-resume-detail-local`                                                                        |
| Logout/account switch                                                | Guest Saved after logout; second identity sees only its newly saved vehicle, no first-account enquiry/support history: `logout-saved-local`, `second-account-*`                 |
| Enquiry → named-dealer consent → receipt → history                   | `enquiry-consent-local`, `enquiry-receipt-local`, `enquiry-history-local`; full notice/version contract retained                                                                |
| Permission → explicit withdrawal → no active permission              | `privacy-permission-local`, `withdraw-confirmation-local`, `permission-withdrawn-local`; no implied consent or silent withdrawal                                                |
| Support → category → create → conversation → reply                   | `support-conversation-local`, `support-reply-local`; backend-confirmed request and remaining message count                                                                      |
| Dirty support → Back → Keep editing / Discard                        | F111 actual native dialog; neutral native theme retested in `native-dialog-neutral`                                                                                             |
| API unreachable → selected sort → error → Retry                      | Only the emulator localhost reverse was removed, then restored. `api-unreachable-local` and `api-recovered-local`; no stale invented count or false empty state                 |
| Home/Cars/Dealers location and towns                                 | F109/F110 public native evidence plus multi-town fixture tests. Live tested public districts expose one town each; do not claim multi-town live acceptance                      |
| Startup-window VIEW + Back                                           | Failed before retention; three final release repetitions reached the detail and returned Home. `startup-window-before`, `startup-window-after-*`, `startup-window-results.json` |
| Detail/gallery/Back/scroll                                           | Public real-photo gallery/system Back and list context are checked separately; final evidence uses `gallery-public`, `gallery-back-detail-public`, `detail-back-cars-public`.   |

## Width and text scaling

`360dp`, `393dp` and `412dp` evidence directories each contain Home, Cars, Sort, Filters, Dealers, Saved guest, Profile guest and sign-in. Exact density/derived width are recorded in each `device.json`; 393 and 412 are representative rounded-density widths. `360dp-font150` repeats these surfaces at 150% system text.

Review found and corrected a nearly fitting header that wrapped at 360dp: the narrow variant retains approved independent symbol/wordmark geometry at a smaller scale. Large text may intentionally put the district pill on a second row. Full accessible district labels remain available. Review also reproduced wrapped/clipped long placeholders; explicit single-line fields and concise placeholders fixed them without disabling text scaling. Before captures remain in `scale-before`.

Large titles, cards and policy links wrap. Sort options remain reachable in the bottom sheet, Filters remains scrollable with its apply action, and the five tab labels remain legible above the gesture inset. These captures and accessibility-tree/role tests do not establish spoken TalkBack behavior or physical-device gesture quality.

## Release measurements

Five process-cold public-preview starts at approximately 412dp/font100 produced native Activity launch times **270, 279, 290, 331 and 280ms** (median **280ms**). Home and real inventory were present at the first successful UIAutomator probe in **3,043–3,269ms**, median **3,080ms**. The probe itself adds seconds: this is an upper bound, not measured JavaScript TTI or API latency. OS/image disk caches remain warm; this is not a first-install benchmark.

After twelve automated Home swipes, `dumpsys gfxinfo` reports **200 frames, 61.50% jank, p50 32ms, p95 53ms**. PSS is **153,995KB**, RSS **292,112KB**, with **10,305KB** of native bitmap allocations. The emulator explicitly uses software graphics; these results cannot distinguish application and host-renderer bottlenecks and cannot pass the budget-device scrolling gate. They must not be relabeled smooth. No comparable F108 benchmark was taken, so no numeric improvement is claimed.

The [raw measurements](evidence/f112/performance/measurements.json), frame data and memory dump are retained. [the measurement script](../../../apps/mobile/scripts/measure-android.py) repeats this bounded nonproduction-emulator measurement with the repository's hash-pinned XML parser. Actual improvements include cancellation/debounce, shared caching, bounded Home fetches, virtualization, fixed image geometry, no same-user cache purge and focused/foreground-only support polling. Search's 350ms debounce is a configured delay, not a latency measurement; a physical release profile must measure end-to-end suggestions/filter/navigation under controlled networks.

## Audit closeout and remaining gates

Audit 01–31 and 34 have code changes and relevant source/native evidence across F109–F112. Finding 13's duplicate Cars-screen hypothesis was corrected during implementation: the old path was already a redirect; route ownership and shared location coordination were still improved. Finding 33 was reproduced in native release, repaired through retained Android intents and verified in three repetitions. Finding 32 remains partly open: release emulator measurements exist, but physical budget-device and controlled-network profiling have not passed. Generic unit/cold-link success is not used as evidence for the startup gap.

Before a launch recommendation can change, finish manual spoken TalkBack/focus traversal, predictive-edge gestures on representative supported Android versions, physical budget-device scrolling/memory and controlled slow-network/end-to-end timing. Emulator screenshots cannot provide these proofs. Re-run the final exact-head CI/guest/startup flows and owner acceptance on a compatible authorized backend. Real-provider OTP, production legal approval, signing/App Links/provider operations and Play approval remain separate owner gates. No remediation PR is merged automatically.

## Launch assessment

| Decision                     | Recommendation | Evidence still required                                                                                                                                                                                                                      |
| ---------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android UI/UX readiness      | **NO-GO**      | Manual spoken TalkBack and predictive gesture acceptance, physical budget-device release profiling and controlled slow-network timings. Measured software-emulator jank is not a performance pass. Final F112 CI must complete successfully. |
| Overall production readiness | **NO-GO**      | Original legal/mobile stack remains unmerged; compatible authorized backend deployment/provider and operational acceptance are separate work. No production rollout is authorized here.                                                      |
| Legal readiness              | **NO-GO**      | Draft local policy/consent tests preserve behavior but do not approve authoritative documents, versions, publication or legal operations. Protected foundation remains unchanged.                                                            |
| Play Store readiness         | **NO-GO**      | Owner-approved production identity/signing/App Links, policy/store materials, physical-device acceptance and Play release review remain required. Validation keys/APKs are not submission artifacts.                                         |

These gates do not undo the implementation/evidence completed in the four remediation PRs. They make explicit which release claims the available evidence cannot support.
