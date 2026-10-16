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
