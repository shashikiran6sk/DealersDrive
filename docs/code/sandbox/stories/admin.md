# sandbox / stories/admin

Parent: [sandbox](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/sandbox/src/stories/admin/admin-access.stories.tsx`

### `const CURRENT = '2f1c4a8e-1111-4b2c-9d3e-5a6b7c8d9e01'`

R42 (C064b) — who may open this console.

**The two sources are the whole component.** An `ALLOWLIST` row is an address
in `ADMIN_ALLOWLIST`, written into the deployment: it shows its tag and no
Withdraw control, because removing it is a change to the environment and a
button that appeared to do that and did not would be worse than none. A
`GRANT` row is a seat a SUPER_ADMIN handed out here, with who handed it over,
and it can be taken back the same way.

Two refusals are worth seeing rendered, because both are doors somebody could
otherwise walk through and not walk back out of:

· **your own row** says `You` where the control would be — withdrawing it
could leave nobody able to let you back in;
· **an allow-listed row** says where the address actually comes from.

Both are enforced on the server as well. The panel is not the guard; it is
the explanation.

A granted address takes effect on that person's **next sign-in** — they still
sign in with Google, and the address has to be the one Google knows them by.
The copy under the heading says so, because "I granted it and nothing
happened" is the support question this screen would otherwise generate.

The Server Actions are stubbed (`src/mocks/access-actions.ts`, coupling C-4).

### `const NEVER_ARRIVED = entry(`

An address on the list that nobody has signed in with. There is no row for them.

### `export const AllowlistedOnly: Story =`

The day the feature ships: one allow-listed operator and nobody else.

### `export const AllowlistedAndGranted: Story =`

The ordinary state — the deployment's operator, and two people they let in.

### `export const NotSignedInYet: Story =`

An allow-listed address with no account behind it yet. `userId` is null, and
the list still shows it — leaving it out would be wrong about who can get in.

### `export const GrantedToADealer: Story =`

A granted seat held by somebody who also runs a dealership — R41's case seen
from this screen. Withdrawing it closes their console and leaves their dealer
account exactly as it was.

### `export const Granting: Story =`

Mid-write. The stub delays, so the pending button is a state you can look at.

### `export const Refused: Story =`

The server refused. Type an address and press Grant access.

## `apps/sandbox/src/stories/admin/admin-nav.stories.tsx`

### `const meta =`

DESIGN-SPEC §3.17 — the admin sidebar nav (C024), on the cobalt-900 field.

**The pathname is most of the component.** `AdminNav` reads `usePathname()`
and decides which item is current; the only way to see any state other than
the default is to tell the router where it is. The
`nextjs.navigation.pathname` parameter is that control, and it is why this
file has one story per route rather than one story with a knob.

## Two lists, and why the shell renders the shorter one (F048)

`ADMIN_NAV` is the baseline's five items and is what the console will be.
`items` defaults to `LANDED_ADMIN_NAV` — the subset whose routes exist —
because `/admin/listings` (**F069**) and `/admin/payments` (**F053**) do not,
and two of five items in a cross-tenant operations console leading to a 404
is the mistake the dealer console has never made.

The stories below pass `ADMIN_NAV` so every route's current state can be
seen; `AsTheConsoleRendersItToday` is what an operator actually gets, and the
gap between it and `Dashboard` is the reconstruction, drawn.

The rule it implements is not "starts with", uniformly: `/admin` would then
be current on every page, since every admin path starts with it. Dashboard
matches exactly and the rest match by prefix — which is what lets
`/admin/dealers/{id}` keep Dealers lit.

The colours live here rather than in the shared `.dd-nav-item` class: those
are tuned for the white dealer sidebar, and overriding them per-consumer in
six places is how a design system starts disagreeing with itself.

### `export const Dashboard: Story = {}`

The landing page. Dashboard is current by an exact match, not a prefix one.

### `export const DealerDetail: Story =`

A dealership detail page. Dealers stays current — the prefix match is what
keeps a nav from going blank the moment you open a record, which is exactly
when an operator most wants to know where they are.

### `export const NothingCurrent: Story =`

A path under no nav item at all. Nothing is current, and nothing is
_arbitrarily_ current — the failure mode worth checking, because a "starts
with `/admin`" rule would light Dashboard here.

### `export const AsTheConsoleRendersItToday: Story =`

What an operator actually sees (**F048**): three items, because three routes
exist. Listings and Payments return with F069 and F053.

Worth looking at beside `Dashboard` above rather than assuming — the sidebar
is noticeably shorter, and the note pinned to its foot is carrying more of
the panel than it was designed to.

## `apps/sandbox/src/stories/admin/config-editor.stories.tsx`

### `function entry(overrides: Partial<ConfigEntry> = {}): ConfigEntry`

D14 (C064) — one platform setting, one control, one save.

**The declared type picks the control.** `number` gets a numeric input,
`boolean` a two-option select, `string[]` a textarea read one entry per line.
That is not cosmetic: these values govern money and moderation, and the
server refuses a value that is not the type the key declares — so the control
that cannot produce a wrong type is the first half of that guard.

**`readBy` decides whether there is a control at all**, and it is the state
worth looking at hardest. The settings table holds every knob the product
will ever have; most of the code that consults them has not been
reconstructed. A key nothing reads renders as a value and a tag, because an
editable field that saves and changes nothing has told the operator they
changed something.

Save is disabled until the value differs from the stored one — a save that
writes the same number is an audit row that says nothing happened.

The Server Action is stubbed (`src/mocks/config-actions.ts`, coupling C-4),
and deliberately slow so the pending button is visible.

### `export const Number: Story = { args: { entry: entry() } }`

A number, and the only type on this screen that is also money.

### `export const Boolean_: Story =`

A flag. Two options rather than a checkbox, because "Enabled / Disabled" is
what the operator is choosing between — a tick box makes them infer it.

### `export const StringList: Story =`

One entry per line, and the hint under the box says so.

### `export const NothingReadsItYet: Story =`

**The placeholder.** Nothing reads this key yet, so there is a value and a
tag and no control. Compare it with `Number` above: the difference is one
field on the API response, and it is the difference between a screen that
tells the truth and one that does not.

### `export const Dirty: Story =`

Changed but not yet saved — Save is live only from here.

### `export const ServerRefusal: Story =`

The server refused it. The row keeps the typed value so it can be corrected.

### `export const Saving: Story =`

Mid-save. The stub delays 700ms so this is a state you can look at.

### `export const PreviouslyChanged: Story =`

A setting that has been changed before, with the date it last moved.

## `apps/sandbox/src/stories/admin/dealer-actions.stories.tsx`

### `const BASE: AdminDealerDetail =`

D4 (C062) — the dealer-moderation controls.

**The `actions` block is the whole component.** It arrives resolved from the
API, so which controls appear is not a decision this component makes and not
one a story can fake around: every scenario below is a different `actions`
shape, which is exactly how the console behaves.

Two things are worth checking by eye rather than by reading the code:

· **Suspend states its blast radius before the button is pressed.** Public
visibility needs `dealer.status === ACTIVE` as well as an approved
listing (rule 6), so one click takes every live car off the marketplace.
The count is in the sentence under the button for that reason.
· **The suspend button is disabled until the reason has substance.** The
dealer reads it verbatim; "no" generates a support call. Six characters
is what `ReasonInput` enforces server-side, and this is the client half
of the same rule.

The Server Actions are stubbed — `src/mocks/admin-actions.ts`, coupling C-4.

### `profileChange: null`

R34. Nothing waiting on a moderator is the ordinary state.

### `export const PendingAndReadyToApprove: Story =`

PENDING_APPROVAL with all three KYC documents verified — the one state in
which approval is offered. The note is internal; the dealer never sees it.

### `export const PendingWithDocumentsOutstanding: Story =`

PENDING_APPROVAL with a document still outstanding. `canApprove` is false —
and the control is rendered anyway, disabled, with a line saying why.

It used to be absent, which is the more usual instinct and was wrong here.
An admin looking at a dealership waiting for a decision and finding no
approve button anywhere cannot tell "not allowed" from "not implemented" —
and for a while it genuinely was the second, because nothing in the console
could verify a document. The disabled control with its reason is the honest
version: the decision is available, its precondition is not met yet, and
`DocumentReview` above it is where that is fixed.

### `export const ActiveAndSuspendable: Story =`

ACTIVE. Type six characters into the reason to watch the destructive button
become available — and read the sentence under it first.

### `export const ActiveWithNoLiveListings: Story =`

An active dealership with nothing live yet. The blast radius is honestly zero.

### `export const Suspended: Story =`

SUSPENDED, with the way back.

`POST /dealers/:id/reinstate` has existed and been documented since F045 and
the console called it from nowhere, which made suspension terminal in
practice while the state machine said otherwise. Restoring a dealership puts
every listing the suspension pulled back into the catalogue (rule 6), so the
control says so before it is pressed.

### `export const DraftAndIncomplete: Story =`

A DRAFT dealership — still filling the form in, nothing to decide yet, but
rejectable.

REJECTED as a _state_ no longer occurs on this screen: rejecting deletes the
application outright, so there is no row left to render. The story that used
to show it was showing a screen the console can no longer reach.

### `export const BothRefusals: Story =`

The two refusals, side by side, which is the comparison this screen exists to
make legible.

**Request changes** is an ordinary control: type six characters, press it,
and the dealer gets their own form back with everything still in it. **Reject
application…** is behind a disclosure, spells out what it destroys, and will
not enable until the dealership's own name is typed into the confirmation box
— because it deletes the KYC scans, the yard photograph, the dealership row
and every field the applicant entered, and none of it comes back.

Open the reject disclosure and read the paragraph before the button. That
paragraph is the whole reason the two are not styled alike.

### `export const Pending: Story =`

The action in flight. The stub holds for eight seconds so the `aria-busy`
button and the frozen form are visible; press Approve to see it.

### `export const ServerError: Story =`

The API refused. The message is the one the API sent, not a generic one —
an admin who is told "that did not work" cannot tell a permissions problem
from a stale page.

## `apps/sandbox/src/stories/admin/dealer-profile-editor.stories.tsx`

### `const BASE: AdminDealerDetail =`

D3 (C062c) — the dealership's own answers, editable from the review screen.

**Why it is not just a definition list.** It was one, and that is right for
the reviews that end in a decision and wrong for the ones that end in a
correction. A moderator holding the GST certificate can see that the dealer
typed one digit of the GSTIN wrong or spelt the district `Vellore Dist.`; the
alternative to fixing it here is a round trip that costs a working day per
character.

Three things to check by eye:

· **It reads before it writes.** The card is a definition list until _Edit_
is pressed. A review screen full of live inputs invites edits that were
meant to be readings, and these same values are what a reviewer compares
against a document.
· **Save is disabled until something actually changed**, and only what
changed is sent. `UpdateDealerInput` is partial; re-writing `legalName`
and `city` with the same values on every save would put the
duplicate-name check in the position of having to ignore a collision with
the row being edited, on a field nobody touched.
· **A refusal lands on the field it names.** The API answers with paths
like `body.address.city`, and `ServerRefusal` below shows what that looks
like against the boxes. A refusal about one entry in a list arrives as
`body.specialities.3`, which is matched by prefix (**R32**) — otherwise
the one box a moderator has to fix is the one box with no message on it.
· **The last two rows are laid out differently, on purpose** (**R32**).
The tagline and the service list are written for a reader rather than
for a form, so they run the full width while editing and are stacked and
left-aligned while reading — the services as chips, which is how they
appear on the page the moderator is comparing this against. They replace
`About`, the last box on the platform reading a paragraph the product
stopped collecting at R26.

The Server Action is stubbed — `src/mocks/admin-actions.ts`, coupling C-4.

### `profileChange: null`

R34. Nothing waiting on a moderator is the ordinary state.

### `export const Reading: Story = { args: { dealer: dealer() } }`

The resting state: everything the dealer entered, read-only, with one Edit.

### `export const WithGaps: Story =`

A half-finished application. Every empty field reads `—` rather than
disappearing — the reviewer's question is often "what has _not_ been
answered", and a row that vanishes cannot answer it.

### `export const ReadOnlySeat: Story =`

A SUPPORT seat, which may read the record and not change it. The Edit button
is absent rather than disabled: there is no state from which this operator can
reach the form, so offering it would be a control that never works.

### `export const Saving: Story =`

The save in flight. Press Edit, change a field, press Save — the stub holds
for eight seconds so the busy button and the frozen form are visible.

### `export const ServerRefusal: Story =`

The API refused, and named the field.

`GSTIN_ALREADY_REGISTERED` is the one that actually happens: two applications
for one registration, and the second is a duplicate rather than a typo. Press
Edit, change anything, press Save.

## `apps/sandbox/src/stories/admin/document-review.stories.tsx`

### `type Document = AdminDealerDetail['documents'][number]`

D5 (C062b) — the KYC checklist with a verdict on each row.

**Why this component exists at all.** `POST /admin/documents/:id/verify` and
its reject twin landed with F044 and nothing in the console called them.
That was not merely a missing pair of buttons: approving a dealership
requires all three documents `VERIFIED`, so with no way to verify one the
approve control could never appear — the console had a dead end shaped like
a missing feature. This is the half that closes it, and
`DealerAdminActions` is the other.

Two things to check by eye:

· **Only an `UPLOADED` row is decidable.** `REQUIRED` has no file behind
it, and a row already decided is re-decided by the dealer re-uploading
rather than by a moderator changing their mind in place. So the stories
below differ by `status` and the controls follow, the same way they do
against the real API.
· **A rejection reason is mandatory and has to have substance.** The
dealer reads it verbatim and re-uploads against it, so "no" costs a
support call. Press Reject and type: the destructive button stays
disabled under six characters, which is the client half of what
`ReasonInput` enforces on the server.

`viewUrl` is a short-lived signed URL and is the only way a KYC document is
ever read — every issue of one is audit-logged (§26.6). The stories carry a
placeholder so the View link is visible; there is nothing behind it.

The Server Actions are stubbed — `src/mocks/admin-actions.ts`, coupling C-4.

### `dealerSlug: 'sri-lakshmi-motors-vellore-tamil-nadu'`

Cache invalidation only, and it never reaches the screen: a decision here
can hand a PENDING_APPROVAL application back to DRAFT, which takes the
dealership off the marketplace, so the action clears that portfolio's
cached page (**R12**). Set once on the meta because no story varies it.

### `export const AwaitingDecision: Story =`

The queue as a moderator finds it: three uploaded documents, none decided.
This is the state the approve control on the dealer card is waiting on.

### `export const MixedStates: Story =`

A mixed checklist, which is what most dealerships look like partway through:
one verified, one rejected with the reason the dealer is reading, and one
still to upload. Only the last-but-one row offers a decision — and the
`REQUIRED` row has no View link either, because there is no file to sign.

### `export const AllVerified: Story =`

Every document verified — no controls left, which is the point of the state.

### `export const Empty: Story = { args: { documents: [] } }`

Nothing uploaded at all. A sentence, not an empty box.

### `export const Deciding: Story =`

The decision in flight. The stub holds for eight seconds so the loading
button is visible — press Verify.

### `export const ServerError: Story =`

The API refused. The message is the one the API sent rather than a generic
one: an admin told "that did not work" cannot tell a permissions problem
from a stale page. It sits above the list, because it belongs to the
checklist rather than to one row.

## `apps/sandbox/src/stories/admin/profile-change-review.stories.tsx`

### `const BASE: AdminProfileChange =`

D3b (C062d) — the card a moderator decides a dealer's own words from
(**R34**).

## What it is guarding

The tagline and the service list are the only free text a dealer writes that
a buyer reads. Everything else on their profile screen has been read-only
since R27; these two stayed editable because a dealership is entitled to
revise how it describes itself. That leaves exactly one route by which a
phone number can reach a public page without passing
`POST /v1/vehicles/:id/reveal-contact` — the one endpoint allowed to hand one
out, rate-limited twice over and logged as a lead. This card is where it gets
caught, and `PhoneNumberInTheTagline` is the story it exists for.

Three things to check by eye:

· **Old and new, side by side, always.** The question is "is this _change_
acceptable", not "is this sentence acceptable", and the two differ
whenever the edit is a small correction to a line already approved. A
card showing only the proposal makes the reviewer hold the old value in
their head — and a reviewer doing that is one who approves a number
appended to a sentence they half-remember.
· **A field the edit does not touch says `unchanged`.** `ServicesOnly` and
`TaglineOnly` are the two. An empty row under Services would read as _the
dealer is clearing their services_, which is the opposite of what `[]`
means here — and a moderator approving that reading approves something
nobody asked for.
· **Refuse needs a sentence before it works.** The dealer reads it verbatim
on their own profile screen, and it is the only account they will ever
get of why their line did not appear.

Neither decision is behind a confirm step, and that is deliberate. Both are
reversible in the way that matters — a refused edit is resubmitted in a
minute, a wrongly published one is edited back — which is a different
category from `Reject dealership`, and dressing them alike would teach a
moderator to click through the one that does destroy something.

The Server Actions are stubbed — `src/mocks/admin-actions.ts`, coupling C-4.

### `export const Default: Story = {}`

Both fields changed — the fullest the card gets.

### `export const PhoneNumberInTheTagline: Story =`

**The story this card exists for.** A tagline with a mobile number in it.

Nothing marks it: no highlight, no warning, no detection. That is honest — a
regex that flagged ten-digit strings would miss `nine eight four zero zero`
and would teach a moderator to trust the absence of a flag. The card's job is
to put the sentence in front of a person at a size they will read it at.

### `export const ServicesOnly: Story =`

Services only. The tagline row reads `unchanged` and keeps the live value on
screen — it is what would survive the approval.

### `export const TaglineOnly: Story =`

And the other way round.

### `export const NothingLiveToCompareAgainst: Story =`

A dealership that has never had a tagline — every row onboarded before R26
asked for one. `—` rather than a blank, so "not answered" reads as a state
rather than as a rendering fault.

### `export const Refusing: Story =`

The refusal path, open. Press `Refuse…` on any story to reach it; this one
starts there so the disabled button is visible without a click.

Type fewer than six characters and the button stays disabled — the client
half of the floor `ReasonInput` enforces server-side.

### `export const AlreadyDecided: Story =`

A decision that lost a race — the other moderator got there first.

The API answers 409 and the card says so rather than showing a tick. Two
moderators working the same queue is the ordinary case, not an edge one.

### `export const Deciding: Story =`

The decision in flight, so the busy button and the frozen card are visible.
