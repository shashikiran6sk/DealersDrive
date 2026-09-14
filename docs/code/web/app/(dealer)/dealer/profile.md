# web / app/(dealer)/dealer/profile

Parent: [web](../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(dealer)/dealer/profile/page.tsx`

### `export default async function DealerProfilePage()`

C1/C2 — the dealership's own record, after onboarding is over.

Both reads are `revalidate: false`: they carry the session cookie, and a
cached fetch that carries a session is how one dealer's console ends up in
another's browser (ARCHITECTURE §18).

The completeness meter is the same one the onboarding wizard used, and it
stays on screen for the same reason it was there: a profile that drifts back
below the bar — a description emptied, a Maps link removed — should be
obvious on the screen that did the emptying, not discovered later.

## Who is allowed to be here

Nothing on this page asks. The guard is on `(dealer)/dealer/layout.tsx`
(**R31**), which resolves a _dealership_ and not merely a signed-in person,
and sends the two kinds of 401 visitor to two different screens — sign-in for
nobody signed in, onboarding for somebody signed in without a dealership.
It was written here at F046 with a note saying F047 should lift it once one
route stopped being the whole segment; it has been lifted, and the next
console page inherits it rather than remembering to repeat it.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline's "View public page →" link is still held back —
`/dealers/:slug` arrives with **F086**, and a link to a 404 is worse than no
link.
────────────────────────────────────────────────────────────────────────────

### `{outstandingNeedsSupport(completeness) ?`

R27 — the meter still reports the truth, but the form below it can no
longer act on most of it.

The meter was put here so that a profile drifting back below the bar
would be obvious on the screen that did the drifting. That reasoning
survives for the three fields this screen still writes; for anything
else it now points at a box the dealer cannot type in, and a warning
with no action attached reads as a broken page. So when something
outstanding is not theirs to fix, the line says who fixes it.

### `const SELF_SERVICE = new Set(['tagline', 'specialities', 'establishedYear'])`

The three fields the form below still writes (**R27**).

Named here rather than imported from the form because they are the same
three for a different reason: this is about what the dealer can _act on_,
and the form is about what the dealer can _send_. They agree today, and if
one ever moves without the other the note is wrong rather than the save.
