# Android UI/UX remediation

The owner explicitly approved the audit and four-child remediation plan on 16 October 2026. The historical audit and before evidence are in [the approved plan](audit-and-approved-plan.md). No original F099–F108 or legal-foundation branch is modified.

## F109 — architecture and design foundation

Base: F108 `945856fd385710cbdd6867a345c8e8fd543a676a`. Head branch: `feat/f109-mobile-ux-foundation`.

- Home / Cars / Dealers / Saved / Profile are independent tabs. Public /cars and /dealers URLs remain valid; legacy Explore redirects to Cars and is hidden from the tab bar. The existing /cars implementation was already a redirect, correcting the audit's duplicate-screen hypothesis.
- Approved symbol plus independent wordmark and a responsive district pill share one header. A reusable accessible radio selection sheet handles loading, error, empty, search, dismissal and Android Back.
- Zustand holds only the public district preference, revision and hydration state. AsyncStorage persists only that slug. Explicit incoming directory links supersede a pending preference read. Directory route params own applied filters; a focus-aware coordinator resets dependent towns/dealer/page after a shared district change. Remote responses remain in TanStack Query.
- SessionManager remains the secure credential/identity owner. A valid already-verified session is revalidated without publishing a temporary null customer. Cold restore still hides private identity; revocation and failure still clear it. This prevents unnecessary same-owner form remounts and private-cache deletion.
- Query focus is tied to native AppState. No private cache persistence or new auth state store is introduced.

Native components reuse the existing Brand and SVG system; DOM sandbox components were inspected and cannot render native primitives. Native Testing Library fixtures cover tab labels, location hydration/races, directory coordination and restored-session behavior. Native screenshots and exact tested SHA are recorded with the PR after execution.

Remaining campaign work: F110 Home/autocomplete/filter/location UX; F111 cards, saved reconciliation and customer journeys; F112 full regression, visual/accessibility/performance acceptance. Foundation checks do not establish production readiness.

## Ownership

```text
SecureStore -> SessionManager -> verified identity and safe pending intent
AsyncStorage -> Zustand -> public district preference only
Validated route -> applied directory filters -> TanStack Query -> API
Component -> search/filter/form drafts and modal state
```

Shared district selection is an explicit navigation event. Canonical routes own the directory query; the store is a preference/coordinator, not a second copy of applied filter data. An inactive tab adopts a changed district on focus and clears its dependent town/dealer selection. Unchanged navigation retains independent filters and scroll.

F109 local validation: 27 suites / 157 tests, mobile lint/boundaries/typecheck, brand integrity, repository formatting and docs-reference checks pass. Local arm64 release-variant APK compiles (compile/target SDK 36) and installs on the read-only Pixel 8 AVD. Native screenshots: [Home](evidence/f109/home.png), [district sheet](evidence/f109/district-selector.png), [Cars](evidence/f109/cars-vellore.png), [Dealers](evidence/f109/dealers-vellore.png), [explicit dealer deep link](evidence/f109/dealer-deep-link.png). Manual checks verify district inheritance, the five tabs, sheet system-Back dismissal, a warm Ranipet directory link and an all-districts directory link. Real public API data was read without customer mutations. Device/build/content provenance is in [the evidence manifest](evidence/f109/provenance.json). These are emulator checks, not physical-device or complete campaign acceptance. Existing support test fixtures emit an asynchronous VirtualizedList act warning; assertions pass and no warning is suppressed.

## F110 — discovery, search and filters

Base: F109 `39edbf868dc40320b56988f4f1ff6c142691a1f4`, draft [#322](https://github.com/shashikiran6sk/DealersDrive/pull/322). Head branch: `feat/f110-mobile-discovery-search`.

Home now prioritizes search and actual inventory with a shorter dark hero, useful discovery links, nonempty category rows and a concise trust explanation. Independent category failures retain successful content. Complete emptiness is based on the whole-market request's available count, not a reserved-only first page. Rare reserved-first teasers use at most three existing public pages; undisplayed available stock is never relabeled zero.

Home and Cars share a native search field and measured anchored overlay with matched text, secondary API labels, clear/loading/empty/error/retry, cancellation, keyboard and Back/outside dismissal. Only selecting a brand/model/variant applies vehicle search. Keyboard Done and generic discovery never submit an unselected draft. The dealer directory reuses the field and retains its supported text search and direct dealer suggestions.

Cars and dealer inventory have separate contract-backed Sort and grouped Filters, with explicit drafts, valid counts and removable applied chips. Draft district changes immediately hide prior-district towns/dealers until matching facets arrive. Dealers uses its route scope, preserves independent filter context and presents API-derived multi-town pills. Profile inventory omits text search, retains supported filters/sort and distinguishes true empty inventory from filtered zero.

Native validation uses actual public API reads only. Screenshots include Home, keyboard-open Home autocomplete, selected results, Sort, Filters, town chips, directory pills and genuine empty district/dealer inventory. UI screenshots do not establish physical-device, TalkBack, offline, authenticated or full-width-matrix acceptance; those remain F112 gates. The API currently offers only one town in each tested district; multiple-town removal/count coordination is automated with isolated contract-shaped fixtures, not invented runtime options.

A native typography finding is deferred to F111: the bundled Manrope variable font's default weight axis is 200, which produces overly thin body copy despite normal-weight styles. Its source remains unchanged in this PR. Header Back/Cancel and saved hearts are also F111 scope.

At the requested approximately ten-minute F109 check, regular CI/security passed and native CI was still running. Work continued on this child; no pending job is labeled passed.

F110 local validation: 31 suites / 173 native tests pass; mobile lint/typecheck/boundaries/brand checks pass. Local arm64 release APK builds and installs. Native selection, actual IME Done/no submit, outside dismissal, Sort selection, filter draft district/town controls, active chips, dealer pills and real empty inventory were exercised. An injected Android Enter key is not the same as tapping the IME Done action; the former left an open panel while hiding the keyboard on this API37 image. The actual Done action dismisses correctly; the complete hardware/predictive Back matrix remains an explicit F112 acceptance item. No passing physical-device claim is made.

At the later F109 check, all exact-head regular/security/native checks passed: CI run 38847423812, security 38847423828 and Android 38847423831. No branch fix was needed. The original ten draft heads remain unchanged.

## F111 — cards and customer journeys

Base: F110 `33f697b47249090bb7ed0bf0806659bc1e76a2c9`, draft [#323](https://github.com/shashikiran6sk/DealersDrive/pull/323). Head branch: `feat/f111-mobile-customer-journeys`. The interrupted local checkpoint `af9bc170` is preserved; follow-up changes are additive.

All placements retain one shared vehicle card with fixed image geometry, wrapping identity, actual price/metadata/status and honest missing-image/price fallback. Recycled image failures reset with identity/URI. Saved controls use outlined/solid neutral SVG hearts and shared optimistic TanStack mutations. Per-car rollback does not overwrite concurrent changes; account/token guards reject late old-owner responses, and logout removes private queries/mutation records. No remote data or credentials enter Zustand.

Pushed screens now use a native stack arrow, sign-in uses a close icon, and gallery uses a contextual title/close control. Redundant content Back/Cancel rows and duplicate utility titles are removed. Unsent enquiry/support/deletion text has a discard confirmation; pending submissions cannot leave and later unexpectedly navigate. Profile destinations are grouped native rows, guest Saved and authenticated empty Saved/enquiry/support states explain the next useful action.

Support category uses a reusable selected-value field and contract-derived radio bottom sheet. Its required choice is validated before submission and the existing category-dependent enquiry reference is retained. The full support disclosure remains available behind an explanation control. Signup and agreements preserve separate unticked Terms and Privacy choices with independent document links. Dealer sharing remains separate affirmative consent identifying the actual recipient and fields, with the full notice/versions/audit/withdrawal contracts unchanged. Draft policy warnings remain visible.

The native regular Manrope face is generated at weight 400 from the retained original variable master instead of its weight-200 default. Build-only fontTools provenance and the original license are retained. Native navigation implementation/upgrade risk is documented in [customer navigation](../../code/mobile/customer-navigation.md).

Local automated validation: 34 suites / 189 tests and four card component snapshots pass; mobile typecheck, lint/boundaries/branding, repository formatting and docs references pass. The release-variant preview APK compiles and is installed on the read-only Pixel 8 emulator. Public GET evidence covers [cards](evidence/f111/cars.png), [guest Profile](evidence/f111/profile-guest.png), [sign-in](evidence/f111/sign-in.png), [guest Saved](evidence/f111/saved-guest.png), policy navigation and the native detail header. These are emulator checks, not physical-device, full authenticated or complete campaign acceptance.

F109 and F110 exact-head CI/security/native checks all passed. F110 runs: CI 38850310692, security 38850310557 and Android 38850310641. Before F111 publication, `main` remains `a969dc2c5223ddb04c23d720ded6a4daccfe33ab`; protected #279 and F099–F108 heads, bases and ancestry match the audited snapshot. No upstream integration is needed.

Additional isolated native F111 checks: local backend flags explicitly report development/local, native auth enabled, fake OTP and draft policy collection. A dedicated QA identity completed signup with separate affirmative choices. The contract-backed support category sheet and native header Back were exercised; Keep editing retains unsent text and Discard explicitly removes it. No production OTP/customer write or new runtime inventory was created. Evidence includes [signup choices](evidence/f111/signup-consent-local.png), [support categories](evidence/f111/support-category-local.png) and [discard confirmation](evidence/f111/discard-local.png). These local draft receipts do not establish production legal approval. A loading indicator now marks in-flight vehicle photos without changing image geometry.

## F112 — regression and native hardening

Base: F111 `2756c9ae64acebe79d6fc8c2d2dfe7fa1e6686b0`, draft [#324](https://github.com/shashikiran6sk/DealersDrive/pull/324). Head branch: `feat/f112-mobile-ux-hardening`.

The campaign acceptance report is [acceptance-results.md](acceptance-results.md). It distinguishes automated fixtures, public inventory reads, isolated fake-OTP journeys, release emulator measurements and remaining physical/manual gates. Standard widths and 150% text exposed clipped long placeholders and an avoidable narrow-header wrap; concise single-line inputs and the approved compact lockup correct them. Native dialog accent now follows neutral branding. Active support conversations omit the redundant New request action and poll only when focused and foreground. Privacy controls use a concise overview plus the full sharing notice, with withdrawal semantics unchanged. Private query/mutation cleanup is extracted for direct cancellation/ownership regression coverage.

An actual startup-window VIEW reproduction failed despite the earlier green cold/warm smoke. The native generated activity now retains a new intent before delegation, preserving the existing validated Router path. A dedicated startup-window Maestro flow precedes the expanded five-tab/Sort/Filters guest smoke. Template-aware generation and native verification are required; this is not a visual-only fix.

F111 all exact-head checks passed while F112 continued: regular CI 38888414282, security 38888414363 and Android 38888414295. The Android35 artifact contains 2/2 successful guest/link flows and no recorded ANR. All three remediation parents remain Draft/open/unmerged; no protected branch or legal foundation is changed.

F112 local checks: **36 suites / 194 tests / four card snapshots**, mobile typecheck/lint/boundaries/branding, root formatting/docs references, four native manifest-validator tests, 24 native ELF checks and APK 16KB ZIP alignment pass. Final release-native startup-window reproduction passes 3/3; public gallery Back, explicit district/town/sort deep link and exact visible list bounds after detail/system Back are verified. Standard-width and 150% text captures are reviewed; evidence uses real public stock or clearly identified existing local test stock. Final release measurements and their software-renderer limitations are retained without an improvement claim. The explicit [four-part launch assessment](acceptance-results.md#launch-assessment) remains NO-GO pending the stated physical/manual/operational gates and final F112 CI.
