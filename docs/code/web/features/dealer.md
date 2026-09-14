# web / features/dealer

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/dealer/profile-actions.ts`

### `export async function saveDealerProfileAction`

C2 `PATCH /v1/dealer` — three fields (**R27**).

Which dealer is being edited is never in this payload — the API takes it from
the session (Rule 1). Nor are `status`, `slug` or `creditBalance` accepted by
`DealerSelfUpdateInput`: a dealer cannot verify or fund themselves by editing
their own profile.

And since R27, neither can they edit the record their verification was _about_
— the registered name, the address, the town, the pin, the mobile, the email.
Those are read-only on the form and absent from this schema, which is two
defences for one rule and deliberately so: the disabled inputs are why a
dealer never sends one, and `.strict()` is why it would not be written if
they did.

The payload is therefore built from three keys rather than filtered down from
the form. A form that grows a box nobody meant to accept is the failure this
shape prevents.

### `revalidatePath('/dealer', 'layout')`

The dealership's name is in the console top bar and on every public card.

### `revalidatePublicDealer(saved.slug)`

And on the public pages, which is the half that was missing.

Everything on this form is rendered to buyers — the name, the address, the
Maps link the portfolio draws its map from, the opening hours — and none of
it moved until two ten-minute windows had expired. A dealer correcting
their own pin watched a stale page and reasonably concluded the save had
not worked.

The slug comes off the response rather than the session, because it is the
dealership this PATCH actually wrote: `dealerId` comes from the session on
the API side (rule 1), so the row that answered is the row that changed.

### `export async function withdrawProfileChangeAction(): Promise<string | null>`

C2c — the dealer taking their own proposal back (**R34**).

`DELETE /v1/dealer/profile-change`, and the same two revalidations the save
does. The public pages did not change — the proposal was never published —
but the dealer's own console did, and `revalidatePath('/dealer', 'layout')`
is what re-renders the profile screen with the boxes unlocked.

`revalidatePublicDealer` is kept for the same reason the admin refusal keeps
it: it costs one re-fetch of a page that comes back identical, and leaving it
out would make this the one write path in the file that has to be reasoned
about separately.

A bare `Promise<string | null>` rather than a form state, because there is no
form: the panel renders a button, and the only thing it can usefully say back
is what went wrong.

### `if (error.status === 404)`

A 404 is the ordinary race — a double-click, or a decision that landed

### `if (error.status === 404)`

while the page was open. The screen is stale either way, and re-reading

### `if (error.status === 404)`

it is the fix, so it is not worth an error the dealer has to dismiss.

### `function flatten`

Zod's dotted paths, folded onto the input names the form uses.

`contact.email` is the input named `contactEmail`, and `address.mapsUrl` the
one named `addressMapsUrl`. One function does it for both the local parse and
the API's refusal, because the two answer in the same vocabulary and a form
that highlighted the right box for one and not the other would be a puzzle
to debug.

### `function mapApiFields(errors: Record<string, string>): Record<string, string>`

`validate()` has already stripped the `body.` prefix; the shape is the same.

## `apps/web/src/features/dealer/profile-form.tsx`

### `export function DealerProfileForm({ dealer }: { dealer: DealerProfile })`

The dealer's own record (C1/C2) — the same answers onboarding collected,
after onboarding is over.

## Three boxes, and a page of read-only facts (**R27**)

The dealer may change **when they started trading, the line they describe
themselves in, and what their yard does**. Everything else on this screen is
rendered `disabled` and carries no `name`, so the browser sends nothing for
it — and `DealerSelfUpdateInput` would refuse it if it did. Two defences for
one rule, deliberately: the form is why a dealer never sends a locked field,
and `.strict()` is why it would not be written if they did.

The split is between _preferences_ and _evidence_. The three editable
answers are opinions a dealership is entitled to revise and that nothing
rests on. The locked ones are what the platform checked:

· the **registered name** is what KYC was run against, and what the slug
and public URL are derived from;
· the **address, town, pin and map link** are what the yard photograph,
the address proof and the verification were _about_;
· the **mobile and email** are how a buyer reaches a business that has
been vouched for;
· **GSTIN and PAN** were read off a document, and have been read-only here
since this screen was built.

A dealership that has genuinely moved does not edit its way to the new
address: it closes this account and opens another, and the new premises are
verified the way the first were. That is a heavier answer than an edit box
and it is the correct one — the VERIFIED plate is a claim about a place, and
there is no honest way to carry it across a move.

── What R27 reversed ───────────────────────────────────────────────────────
Three earlier decisions made these boxes editable, and each was right about
its own question and wrong about this one:
· **R2/D6** made city, district and state typed rather than a dropdown off
a five-row table. Still true — an admin types them. Not the dealer.
· **R6** put the Maps link on this screen as the portfolio's only source
for "Get directions". Still the only source; still not editable here.
· **R7** made the mobile editable, on the reasoning that it had stopped
being a login credential. Right about identity, wrong about the field: it
is the number printed on a verified dealership's public page.

**No "Trading name"** remains true for its own reason: `brandName` is the
server-written mirror of `legalName`, and two boxes able to disagree is what
its absence prevents.
───────────────────────────────────────────────────────────────────────────

### `const waiting = dealer.profileChange?.status === 'PENDING' ? dealer.profileChange : null`

While a change waits, the two boxes are **shut** and show the proposed text
(**R34**).

The dealer has already said what they want; the question in front of them
is no longer "what should this say" but "do I stand by this". Leaving the
boxes live in that state offers an edit the API refuses with a 409, which
is the worst of the three options — worse than locking them, and worse than
silently merging, because the dealer types a sentence and is then told they
could not have.

So the boxes hold the proposal, read-only, and the way to change it is the
`Cancel` in `ReviewPanel`: withdraw, and they unlock with the live values
back in them. Two states, both of them honest.

A REJECTED change locks nothing and is _not_ put back in the box. The
moderator's reason is above it and the point is to write something
different — restoring the refused text invites the dealer to press Save
again unchanged.

### `{state.status === 'saved' ?`

R34 — what "saved" means now, and it is not "published".

The two sentences on this form go to a moderator, so a bare "Your
profile has been saved" would be read as "your page has changed" by a
dealer who then looks at their page and finds it has not. The banner
that follows a save says what actually happened; `ReviewPanel` below it
says what is waiting and what is still live.

### `<LockedField id="legalName" label="Dealership name" value={dealer.legalName} />`

R27 — read-only. The registered name is what KYC was checked
against and what the public slug and URL are derived from, so it is
not a preference a dealer revises after verification.

### `<Field id="establishedYear" label="Established" error={establishedYearError}>`

Still theirs: a fact about the business that no verification
rests on, and one that never becomes a different dealership.

### `<Input`

`disabled` **and** no `name` while a change waits, which is the
R27 shape and load-bearing for the same reason: a disabled control
is not submitted, and one with no name has nothing to be submitted
under. So a locked box cannot reach `saveDealerProfileAction` even
by accident, and the action does not have to filter it out — a save
in this state carries the established year and nothing else.

### `<Field`

Required too (**R26**), and for the reason the tagline is: the first
three are on the directory card and all of them are on the portfolio,
which makes this the only structured thing a buyer can compare two
dealerships by.

### `<LockedField id="contactPhone" label="Mobile" value={dealer.contact.phoneDisplay} mono />`

R27 reverses R7. The number stopped being a credential when dealers
moved to Google sign-in, and R7 made it editable again on that
reasoning — which was right about identity and wrong about what the
field is for. It is the number printed on a verified dealership's
public page, and a self-service edit re-points every listing at a
phone nobody checked.

### `<LockedNote>`

R27, and the heaviest of the three locks.

The yard photograph, the address proof and the verification visit were
all about _this_ place. A dealership that edits its way to another one
is not correcting a record — it is a different business wearing a
plate that was granted to the first. There is no in-place answer to
that, so there is no edit box and no request queue either: a
dealership that has moved closes this account and opens another,
and the new address is verified the way the first one was.

### `function ReviewPanel({ change }: { change: DealerProfileChange | null })`

What is waiting for review, or why the last edit was refused (**R34**).

## Why this panel exists at all

The dealer presses Save, the page reloads, and the tagline box shows the line
they typed — but their public page shows the old one, because the edit is
waiting. Without something on this screen saying so, the honest state of the
product is invisible, and a dealer who cannot see their change concludes the
save failed. Then they do it again. Then they email support.

So the panel says three things in the order a dealer wants them: that the
edit was received, what it will look like, and what buyers are seeing in the
meantime.

## Both values, side by side

The live value is rendered next to the proposed one rather than left to the
boxes below, because the boxes show what the dealer _typed_ — the form
defaults to the proposal once one exists — and "what my page says right now"
would otherwise be the one thing this screen cannot tell them.

## A refusal is the only thing here a dealer must read

`decisionReason` is a sentence a person wrote about this dealership, and it
is the only account they will ever get of why their line did not appear. It
is given the `err` banner and the reason is set apart from the surrounding
copy, for the reason `ChangesRequested` sets its note apart in onboarding: two
equal-looking paragraphs, only one of which is actionable, is how the
actionable one gets skimmed past.

## Cancel is the only control here, and it is the only way out

The two boxes below are shut while this panel is showing, so this button is
how a dealer changes their mind: withdraw, and the boxes unlock with the live
values back in them.

It is a plain button with no confirm step. Nothing is destroyed by it — what
buyers see never moved, and the dealer keeps every word they wrote in the box
in front of them until they replace it. A confirm dialog on an action that
loses nothing is how people learn to click through the ones that do.

Nothing renders for an APPROVED change — the API sends `null` for one, since
its values are on the profile by then and a banner announcing that a line the
dealer can see is the line they asked for is only ever in the way.

### `function LockedField(`

A fact about the dealership, in the shape of the field it used to be
(**R27**).

`disabled` and **without a `name`**, which is the load-bearing half: a
disabled control is not submitted, and one with no name has nothing to be
submitted under. So a locked value cannot reach `saveDealerProfileAction`
even by accident, and the action does not have to filter it out — it builds
its payload from three keys rather than reading the form.

A box rather than a `<dl>` row, because that is what this page has always
done with GSTIN and PAN and the eye reads the column as one thing. `—` for a
value the dealership never gave: an empty control under a label reads as a
box you have not filled in yet, which is the opposite of what is true here.

`children` is for the one field that has something to say about itself —
the Maps link, and what kind of map it draws.

### `function LockedNote({ children }: { children: ReactNode })`

Why a section is read-only, said once at the top of it rather than on every
box in it.

A control a person cannot use and is not told why about is the worst of the
three states this screen can be in — worse than an editable box and worse
than no box at all, because the dealer's conclusion is that the page is
broken. The same 12px `ink-subtle` note the Tax identifiers section has
carried since this screen was built.

### `function MapKindNote({ mapsUrl, kind }: { mapsUrl: string | null; kind: MapKind })`

What the saved link is actually drawing, in words (**R20**).

A dealer pastes a URL into a box and never sees the map it produces — the
map is on their public page, and the difference between the two kinds of
link is invisible in the box. So the difference is said out loud here:

`PLACE` the frame is their Google listing — name, address, rating
`POINT` a correctly-placed pin that names nothing, and the fix
`NONE` a link we could not read a position out of at all

The `POINT` case is the one this exists for, and it is not rare: the Share
sheet on a phone hands out a short link, and whether that link resolves to a
_place_ depends on whether the dealer opened their business's own card before
sharing or dropped a pin on their street. Both look identical afterwards.

`NONE` with no link at all says nothing: there is nothing to diagnose, and a
line telling a dealer that an empty box is empty would be noise.

**R27 changed what these say to do.** The link is read-only now, so "share
your business from Google Maps again" is advice a dealer cannot act on. The
diagnosis is worth as much as it ever was — it explains a public page that
shows a bare pin — so it stays, and the remedy is support.

`mapKind` is composed by the API from the same function that builds the embed
URL, so this cannot claim a listing over a page drawing a dot.
