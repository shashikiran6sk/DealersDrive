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
