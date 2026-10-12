# web / features/admin/manual-activation-notice

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/manual-activation-notice/manual-activation-notice.tsx`

### `export function ManualActivationNotice({ activation }: { activation: DealerActivationState })`

The persistent warning on a dealership that was activated by a Super admin's
override rather than the standard document review (**#299**).

It is a server component, sits directly under the dealership's name and status,
and shows for as long as the method is `MANUAL_OVERRIDE` — not a toast after the
override and not a line in the history. Every later reviewer of this dealership
needs to know, before reading anything else on the page, that it is live
without verified documents: the method label, who did it and when, the
justification they recorded, and which categories are still unverified.

**It says the override verified nothing.** A manual activation never marks a
document verified and never grants Dealer Verified; the outstanding categories
are still reviewed the normal way below. Once both categories are verified the
API changes the method to `STANDARD` on its own (audited as
`dealer.activation_standardised`), and this notice disappears with it — which is
why there is no "dismiss".

### `documentGapLabel(gap)`

`outstanding` carries category codes. The admin wording comes from
`lib/document-gaps.ts`, shared with the document review's outstanding list, so
the two lists on one page cannot word the same gap differently.
