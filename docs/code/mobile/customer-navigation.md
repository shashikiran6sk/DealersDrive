# Native customer navigation and form dismissal

F111 uses the root native stack header for pushed screens and a close icon for sign-in. Tabs own their branded district header. Gallery and selection Modals own their safe-area, close and Android `onRequestClose` handling. Content-level Back/Cancel buttons are removed; destructive confirmations remain.

The root `initialRouteName` anchors cold detail links to the tabs. Expo Router owns history, tab identity, filter params and scroll instances. The `NavigationBack` control uses history with a canonical fallback for a standalone route. No navigation state is persisted in Zustand.

`useDiscardChanges` protects meaningful unsent support/enquiry/deletion text. A pending request blocks leaving until its bounded request finishes. Confirmed support creation sets a completion ref before replacing the route, so its own successful transition does not show a discard warning. Clean forms, selectors and checkbox-only drafts dismiss normally. Sign-in preserves its existing abort/generation/pending-intent cancellation on native removal.

Expo Router 57.0.27 vendors React Navigation. The small guard adapter imports `usePreventRemove` from that installed router's core subpath because the root Expo export does not expose it. Installing a second navigation runtime would use a different context. This private import is pinned to the lockfile and requires a native Back regression on Expo upgrades. It must migrate to a public export when the installed router supplies one. Tests exercise the removal callback; installed emulator checks remain necessary for the actual native event.

PolicyChoice gives each legally separate choice an accessible checkbox and an independently tappable document link. Reading a policy never checks consent. Enquiry sharing still identifies the dealership, fields and purpose; its full sharing notice, versions, receipt and withdrawal remain authoritative. Support disclosure is available through an expandable explanation and the Privacy Policy instead of occupying the initial form.

The original Manrope variable master defaults to weight 200. `scripts/regular-font.py` deterministically generates weight 400 using fontTools 4.67.0. Source, output hashes and the existing OFL license are recorded beside the retained master. This changes the native regular face without adding an application dependency; heavier styles continue to use native weight handling.
