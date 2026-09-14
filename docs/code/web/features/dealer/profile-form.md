# web / features/dealer/profile-form

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/dealer/profile-form/locked-field.tsx`

### `export function LockedField({ id, label, value, mono, children }: LockedFieldProps)`

A fact about the dealership, in the shape of the field it used to be (**R27**).

`disabled` and **without a `name`**, which is the load-bearing half: a
disabled control is not submitted, and one with no name has nothing to be
submitted under. So a locked value cannot reach `saveDealerProfileAction` even
by accident, and the action does not have to filter it out.

A box rather than a `<dl>` row, because that is what this page has always done
with GSTIN and PAN. `—` for a value the dealership never gave: an empty control
under a label reads as a box you have not filled in yet.

## `apps/web/src/features/dealer/profile-form/locked-note.tsx`

### `export function LockedNote({ children }: { children: ReactNode })`

Why a section is read-only, said once at the top of it rather than on every box
in it. A control a person cannot use and is not told why about is the worst of
the three states this screen can be in, because the dealer's conclusion is that
the page is broken.

## `apps/web/src/features/dealer/profile-form/map-kind-note.tsx`

### `export function MapKindNote({ mapsUrl, kind }: { mapsUrl: string | null; kind: MapKind })`

What the saved link is actually drawing, in words (**R20**).

A dealer pastes a URL into a box and never sees the map it produces, and the
difference between the two kinds of link is invisible in the box:

`PLACE` the frame is their Google listing — name, address, rating
`POINT` a correctly-placed pin that names nothing
`NONE` a link we could not read a position out of at all

`POINT` is the case this exists for, and it is not rare: the Share sheet on a
phone hands out a short link, and whether it resolves to a _place_ depends on
whether the dealer opened their business's card before sharing. Both look
identical afterwards. `NONE` with no link at all says nothing.

**R27 changed what these say to do.** The link is read-only now, so "share your
business from Google Maps again" is advice a dealer cannot act on; the
diagnosis stays and the remedy is support.

## `apps/web/src/features/dealer/profile-form/profile-form.tsx`

### `export function DealerProfileForm({ dealer }: { dealer: DealerProfile })`

The dealer's own record (C1/C2) — the same answers onboarding collected, after
onboarding is over.

**Three boxes, and a page of read-only facts (R27).** The dealer may change
when they started trading, the line they describe themselves in, and what
their yard does. Everything else is `disabled` and carries no `name`, so the
browser sends nothing for it — and `DealerSelfUpdateInput` would refuse it if
it did. Two defences for one rule, deliberately.

The split is between _preferences_ and _evidence_. The three editable answers
are opinions a dealership is entitled to revise. The locked ones are what the
platform checked: the registered name KYC was run against and the slug derives
from; the address, town, pin and map link the yard photograph and address
proof were _about_; the mobile and email a buyer reaches a vouched-for
business on; the GSTIN and PAN read off a document.

A dealership that has genuinely moved does not edit its way to the new
address: it closes this account and opens another. That is heavier than an
edit box and it is correct — the VERIFIED plate is a claim about a place, and
there is no honest way to carry it across a move.

**No "Trading name"**: `brandName` is the server-written mirror of
`legalName`, and two boxes able to disagree is what its absence prevents.

### `const waiting = dealer.profileChange?.status === 'PENDING' ? dealer.profileChange : null`

While a change waits, the two boxes are **shut** and show the proposed text
(**R34**). The dealer has already said what they want; the question is no
longer "what should this say" but "do I stand by this". Leaving the boxes
live offers an edit the API refuses with a 409 — worse than locking them and
worse than silently merging, because the dealer types a sentence and is then
told they could not have. The way to change it is `Cancel` in `ReviewPanel`.

A REJECTED change locks nothing and is _not_ put back in the box: the point
is to write something different, and restoring the refused text invites the
dealer to press Save again unchanged.

### `{state.status === 'saved' ?`

R34 — what "saved" means now, and it is not "published". A bare "Your
profile has been saved" would be read as "your page has changed" by a
dealer who then looks at their page and finds it has not.

### `<LockedField`

R27 — the registered name is what KYC was checked against and what
the public slug and URL derive from.

### `<Field`

Still theirs: a fact about the business that no verification rests
on, and one that never becomes a different dealership.

### `<Input`

`disabled` **and** no `name` while a change waits — the R27 shape, and
load-bearing for the same reason: a locked box cannot reach
`saveDealerProfileAction` even by accident, so a save in this state
carries the established year and nothing else.

### `<Field`

Required too (**R26**), and for the reason the tagline is: the first
three are on the directory card and all of them are on the portfolio,
which makes this the only structured thing a buyer can compare two
dealerships by.

### `<LockedField id="contactPhone" label="Mobile" value={dealer.contact.phoneDisplay} mono />`

R27 reverses R7. The number stopped being a credential when dealers
moved to Google sign-in, which was right about identity and wrong
about what the field is for: it is the number printed on a verified
dealership's public page, and a self-service edit re-points every
listing at a phone nobody checked.

### `<LockedNote>{PROFILE_FORM_TEXT.addressNote}</LockedNote>`

R27, and the heaviest of the three locks. The yard photograph, the
address proof and the verification visit were all about _this_ place. A
dealership that edits its way to another one is a different business
wearing a plate granted to the first, so there is no edit box and no
request queue either.

## `apps/web/src/features/dealer/profile-form/review-panel.tsx`

### `export function ReviewPanel({ change }: { change: DealerProfileChange | null })`

What is waiting for review, or why the last edit was refused (**R34**).

Without it the honest state of the product is invisible: the dealer presses
Save, the tagline box shows the line they typed, and their public page shows
the old one. A dealer who cannot see their change concludes the save failed,
does it again, then emails support. So the panel says three things in the
order a dealer wants them — the edit was received, what it will look like, and
what buyers are seeing meanwhile.

**Both values, side by side**, because the boxes below show what the dealer
_typed_, and "what my page says right now" would otherwise be the one thing
this screen cannot tell them.

**A refusal is the only thing here a dealer must read.** `decisionReason` is a
sentence a person wrote about this dealership, so it gets the `err` banner and
is set apart from the surrounding copy: two equal-looking paragraphs, only one
of which is actionable, is how the actionable one gets skimmed past.

**Cancel is the only control, and the only way out**, since the boxes below are
shut while this is showing. A plain button with no confirm step: nothing is
destroyed by it, and a confirm dialog on an action that loses nothing is how
people learn to click through the ones that do.

Nothing renders for an APPROVED change — the API sends `null` for one.
