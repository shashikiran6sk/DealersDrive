# Mobile navigation

`MobileNav` reuses the shared Radix dialog for focus trapping, Escape, outside
click, scroll locking and return focus. Dealer and admin callers supply their
existing permission-filtered items; it does not derive permissions or routes.

The drawer closes when a destination is selected, the pathname changes, or the
viewport reaches the existing 768px sidebar breakpoint. Closing on resize also
releases Radix's body scroll lock. The trigger and drawer are absent visually
at desktop widths, where the existing navigation remains in use.

`heading` places account identity and actual dealer status above destinations.
`navigation` accepts the same console navigation used by the desktop sidebar;
link selection still closes the drawer. This lets shared console utilities reach
both locations without duplicating routes or permissions. Dealer callers omit
credits and use this drawer as their only mobile console navigation.

`brand` (R118) puts a mark in the drawer's header, on the left, with the close
button on the right. The customer header passes `HeaderBrand` — the same DD
logo and wordmark as the header bar — because below `sm` the header bar hides
its wordmark and the drawer is where a phone user sees the name. The drawer's
accessible name stays the `label`, as a visually hidden title beside the brand,
and a link in the brand closes the drawer like any other destination
(`closeOnLink`, the one handler all three link areas share). The consoles pass
no brand and keep their visible title.
