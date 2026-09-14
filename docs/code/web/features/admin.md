# web / features/admin

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/access-actions.ts`

### `export async function grantAdminAccessAction(input:`

Who may open the admin console (**R42**).

This is the most consequential write on the settings screen and the only one
that hands somebody a cross-tenant seat, so it goes through the same
`.strict()` contract the API validates with before the request leaves — a
typo'd field becomes a message in the form rather than a 400 to interpret.

The address is lower-cased and trimmed by the schema, on both sides, because
the value on the left was typed by a person and the value it will eventually
be compared against came out of a Google identity token.

## `apps/web/src/features/admin/actions.ts`

### `export interface AdminResult<T = undefined>`

Admin moderation (D4, D6, D9–D12).

These are the actions that move credits and change what the public can see.
Approving a dealership is the one that matters most here: public visibility
requires `dealer.status === 'ACTIVE'` as well as an approved listing, so this
single write is what puts a dealership's whole catalogue in front of buyers —
and suspending is what takes all of it away again, at once (rule 6).

Every action re-parses its input against the same contract the API validates
with, before the request leaves. That is not belt-and-braces: it turns a
typo'd field into a message in the form rather than a 400 the user has to
interpret, and it is free, because the schema already exists.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline file also carries the four listing decisions (**F070**, F071)
and `grantCreditsAction` (**F054**). Each lands with the endpoint it calls.

`reinstateDealerAction` and the two document decisions are **not** ports.
The baseline console called none of them: the endpoints existed and were
documented, and nothing in the UI reached them. That left two dead ends a
moderator could walk into and not walk out of. A suspended dealership could
only be brought back through the API, and — worse — a document could only be
_verified_ through the API, which meant `canApprove` (which requires all
three verified) was never true and the approve button never appeared at all.
The three actions below are what make the console's own state machine
traversable.
────────────────────────────────────────────────────────────────────────────

### `function refreshAdmin(slug?: string): void`

The console's own pages, and the public ones the decision just changed.

The second half was missing, and on these paths it is the half that matters:
public visibility is `dealer.status === 'ACTIVE'` (rule 6), so a suspension
is the write that takes a dealership off the marketplace — and the portfolio
went on being served from Next's cache for up to ten minutes afterwards. A
dealership suspended for cause staying up for ten minutes is not untidiness.

`slug` is passed in rather than read off the response because
`DealerModerationResponse` carries an id and no slug, and every caller is a
screen already rendering `AdminDealerDetail`. Omitting it still clears the
directory and the header, so a caller that forgets degrades to the old
behaviour on one page rather than breaking.

### `export async function reinstateDealerAction`

Suspension is not a terminal state, and the console should not treat it as
one. This is the way back: SUSPENDED → ACTIVE, which restores every listing
the suspension pulled out of the catalogue (rule 6).

### `export async function verifyDocumentAction`

D5. The two KYC decisions.

Approving a dealership requires all three documents verified, and verifying
one was previously an API-only action — so the approve control was
unreachable from the console by construction. These are what close that loop.

### `if (!parsed.success) return { ok: false, message: 'A rejection needs a reason.' }`

The dealer reads this verbatim and re-uploads against it, so it is the one

### `if (!parsed.success) return { ok: false, message: 'A rejection needs a reason.' }`

field on this screen that cannot be left to a default.

### `export async function rejectDealerAction`

The destructive refusal.

It does not set a status — it deletes the application: the KYC scans and the
yard photograph go from storage, the dealership row goes with its documents
and its membership, and the applicant is left able to start onboarding afresh
as a first-time applicant.

The dealership no longer exists when this returns, so the caller must
navigate away rather than refresh: `/admin/dealers/{id}` is a 404 from here
on. `requestDealerChangesAction` below is the reversible answer, and is the
one a moderator wants nine times in ten.

### `export async function requestDealerChangesAction`

The reversible refusal: PENDING_APPROVAL → DRAFT with the reason attached.

Nothing is deleted. The dealer signs in to their own form again, filled in,
with the reason at the top of it — which is what "the GST certificate is
unreadable" actually calls for, and what rejecting would answer by throwing a
real business's whole application away.

### `if (!parsed.success) return { ok: false, message: 'Say what the dealer needs to change.' }`

The dealer reads it verbatim and corrects against it, so it is the one

### `if (!parsed.success) return { ok: false, message: 'Say what the dealer needs to change.' }`

field on this control that cannot be left to a default.

### `export async function updateDealerAction`

D3 — the console amending the dealer's own answers.

Parsed against `UpdateDealerInput`, the same schema the API validates with
and the same one `PATCH /v1/dealer` takes, so a GSTIN the API would refuse is
marked against the box the admin typed it into rather than coming back as a
400 to interpret.

### `refreshAdmin(data.slug)`

This one answers with the dealership, so the slug is the row that was

### `refreshAdmin(data.slug)`

actually written rather than one the caller believed in.

### `const data = await apiSend<DealerModerationResponse>`

Suspending hides every one of this dealer's listings at once: public

### `const data = await apiSend<DealerModerationResponse>`

visibility requires `dealer.status === ACTIVE` as well as an approved

### `const data = await apiSend<DealerModerationResponse>`

listing (Rule 6).

### `export async function approveProfileChangeAction`

D3b — publishing or refusing a dealer's proposed words (**R34**).

Both actions clear the public pages off the **response**, not off a slug the
console was rendering with. `ProfileChangeDecisionResponse.dealerSlug` is the
row the API actually wrote, which is the only trustworthy answer to "which
portfolio changed" — a moderator with two tabs open would otherwise clear
whichever dealership they last looked at.

A refusal clears them too, and that is not wasted work: nothing about the
dealership moved, but the console's own dealer list and the review card did,
and `refreshAdmin` is what re-renders those. The public tags being dropped as
well costs one re-fetch of a page that will come back identical.

### `const parsed = ReasonInput.safeParse(input)`

Re-parsed here as well as at the API, for the reason every action in this
file does it: a six-character floor enforced only server-side reaches the
moderator as a 400 they have to interpret. The floor itself is the point —
this sentence is the whole of what the dealer will be told.

## `apps/web/src/features/admin/admin-access.tsx`

### `export function AdminAccessPanel(`

Who may open this console (**R42**).

## What it is doing, and what it is not

Until now the answer was `ADMIN_ALLOWLIST` alone: a comma-separated list in
the environment, which meant adding a colleague was a deploy. That bought a
real property — no bug in an admin screen could promote anybody, because the
row was not what was consulted — and it cost a deploy for a thing that
happens when somebody joins.

A **grant** is the second answer. It is a row, made deliberately by a
SUPER_ADMIN, recorded with who made it and audited. The allow-list is still
the first answer and still cannot be edited from here, which is why those
rows show `Allow-listed` and no Withdraw button: taking somebody off the list
is still a change to the deployment, and a button that appeared to do it and
did not would be worse than no button.

## Two things this screen refuses

**Your own seat.** Withdrawing it would lock the person doing it out of the
screen they are standing on, and there may be no one else to let them back in.

**An allow-listed address.** See above — the environment wins, and the row
says so rather than offering a control that cannot keep its promise.

### `if (entry.userId === null) return`

`canRevoke` is false for every row without a userId — an allow-listed

### `if (entry.userId === null) return`

address nobody has signed in with has no account to withdraw — so this

### `if (entry.userId === null) return`

narrowing never refuses a control the operator can actually see.

## `apps/web/src/features/admin/config-actions.ts`

### `export async function updateConfigAction`

D14 — platform configuration.

These values govern money and moderation (GST percent, listing duration,
minimum photos, rate limits), so each one is written individually with its
declared type rather than as a blob PATCH — a string where a number belongs
would silently change what a credit costs.

### `revalidatePublicConfig()`

Some of these keys are rendered on public pages — the social links in
the footer are (**R44**) — and those pages hold the payload for ten
minutes. Clearing the tag unconditionally rather than only for the keys
that are public: the set of public keys is a fact about the API, and a
second copy of it here would be wrong the first time one is added.

## `apps/web/src/features/admin/config-editor.tsx`

### `export function ConfigRow({ entry }: { entry: ConfigEntry })`

D14 — one row, one value, one save.

## The row has two shapes, and the second one is the honest half

A `platform_config` row is a number in a table until something reads it. The
table is complete — every key the product will ever need is already in
`CONFIG_DEFAULTS` — but most of the code that consults them has not been
reconstructed yet: `listing.durationDays` waits on F064, the reveal caps on
F090, the RC lookup knobs on F057.

So the row renders a control when the API says something reads the key, and a
**placeholder** when nothing does. A placeholder is deliberately not an
editable field that quietly does nothing: an operator who sets "minimum
photos" to 8 and watches it save has been told the platform now requires
eight photos, and nothing on this screen would ever contradict them.

`readBy` comes from the API rather than from a list in this file, because the
question it answers — _does any running code consult this key_ — is a fact
about the server.

### `function PlaceholderRow({ entry }: { entry: ConfigEntry })`

A key nothing reads yet.

The value is shown, because "what will this be when the feature lands" is a
real question, and the control is not, because changing it would change
nothing and say otherwise.

### `function displayValue(entry: ConfigEntry): string`

The stored value as one line — a list becomes "3 entries" rather than a wall.

## `apps/web/src/features/admin/dealer-actions.tsx`

### `export function DealerAdminActions({ dealer }: { dealer: AdminDealerDetail })`

D4 — the dealer-moderation controls.

Which controls appear is the API's answer, not this component's: `actions`
comes back on `AdminDealerDetail` already resolved from the dealership's
status, so two admins looking at one record cannot reach different
conclusions about what is available.

Suspending pulls every one of this dealer's listings out of the catalogue at
once, so the count is stated before the button is pressed (rule 6) — and the
button stays disabled until there is a reason of substance behind it, because
the dealer reads that reason verbatim.

**The approve control is rendered from the status, not from `canApprove`.**
That is the fix for a screen that read as broken: `canApprove` is
`PENDING_APPROVAL && allDocumentsVerified`, so an application whose documents
had not been reviewed yet showed no approve button at all — and, since
verifying a document was itself an API-only action, that was every
application. A moderator looking at a dealership waiting for a decision now
always sees the button; when the documents are not verified it is disabled
and says which condition is unmet. The permission is still the API's to
enforce, and it still does.

**Reinstate is here for the same reason.** SUSPENDED is not a terminal state
and the console should not present it as one.

**The two refusals are separated, and separated hard.** They were one word —
"reject" — doing two jobs, and the console offered neither. _Request changes_
hands the application back to the dealer as DRAFT with a note: nothing is
deleted, every field they typed is still there, and they fix the one thing
and resubmit. _Reject_ deletes the application — scans, yard photograph,
documents, membership and the dealership row — and the applicant starts over
as a first-time signup. An unreadable GST certificate calls for the first;
answering it with the second costs a real business everything they entered.

So the two do not look alike. Request changes is an ordinary control sitting
where a moderator will reach it. Reject is behind a disclosure, states what it
destroys in the sentence above the button, and needs the dealership's own name
typed to confirm — the same shape as any other irreversible delete, for the
same reason: the cost of a mis-click here is somebody else's business.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline renders a third block here — a standalone credit grant, gated on
`actions.canGrantCredits` — and an onboarding-credits field inside the
approval block. Both move credits, which means a `CreditTransaction` through
`moveCredits` (rule 4), and neither the model nor the facade exists until
**F050**. They return at **F054** with the endpoint that backs them;
`canGrantCredits` is already in the contract and is deliberately unread here
rather than removed.
────────────────────────────────────────────────────────────────────────────

### `const awaitingDecision = dealer.status === 'PENDING_APPROVAL'`

Waiting for a decision. The button appears on this; whether it is _usable_

### `const awaitingDecision = dealer.status === 'PENDING_APPROVAL'`

is `canApprove`, which additionally wants the KYC documents verified.

### `destination?: string`

Where to go afterwards, when refreshing is not an option.

Rejection deletes the dealership, so this page is a 404 the moment it
succeeds — `router.refresh()` would replace the confirmation with a
not-found screen and leave the moderator wondering what happened.

### `{!dealer.actions.canApprove ?`

A disabled button with no explanation is indistinguishable from a
broken one. This is the missing condition, stated.

### `{dealer.actions.canRequestChanges ?`

The reversible refusal, immediately under approve — because those two
are the decisions a moderator actually makes on this screen. Nothing is
deleted: the dealer gets their own form back, filled in, with this
sentence at the top of it.

### `{dealer.actions.canReject ?`

Reject — and it is a delete, so it is shaped like one.

Behind a disclosure rather than beside "Request changes", because the
two words read as neighbours and the outcomes are not: one asks for a
clearer photograph, the other removes a business's entire application
from the platform. What it destroys is spelt out in full before the
control appears, and the dealership's own name has to be typed — the
standard confirmation for an irreversible delete, and warranted here for
the standard reason: the thing being destroyed is somebody else's.

### `'/admin/dealers'`

The dealership is gone; this page is a 404 now.

### `{!awaitingDecision &&`

With grants deferred to F054, a suspended-and-reinstated dealership at
rest has nothing to decide — and a card rendering a bare heading reads as
a rendering bug rather than as "nothing to do here".

## `apps/web/src/features/admin/dealer-profile-editor.tsx`

### `const FIELDS = [`

D3 — the dealership's own answers, editable from the review screen.

The screen showed them as a definition list, which is right for the ninety
percent of reviews that end in a decision and wrong for the ten that end in a
correction. A moderator holding the GST certificate can see that the dealer
typed one digit of the GSTIN wrong, or spelt the district `Vellore Dist.`; the
alternative to fixing it here is a round trip that costs a working day per
character. So the same fields the dealer filled in are writable here.

**It reads before it writes.** The form is a display until _Edit_ is pressed,
because a review screen full of live inputs invites edits that were meant to
be readings — and because the same values are what a reviewer is comparing
against a document. Cancel restores what the API last said.

**Only what changed is sent.** `UpdateDealerInput` is partial, so the patch is
the diff against the values this component was rendered with. That is not an
optimisation: sending the whole form would re-write `legalName` and `city`
with the same values on every save, and the duplicate-name check would then
have to be told to ignore a collision with the row being edited on a field
nobody touched.

The API is the authority on all of it. Every one of these fields goes through
the same `dealers.update` the dealer's own `PATCH /v1/dealer` does — locality
normalisation, the E.164 rewrite, the name-within-a-city uniqueness check —
and a refusal comes back naming the field, which is what `errors` renders
against.

### `const FIELDS = [`

The fields, and where each one lives in `UpdateDealerInput`.

One table rather than one JSX block per input: the form, the initial values,
the diff and the error mapping all walk it, and a field added to a form but
forgotten in the diff is the kind of bug that looks like "the console did not
save my change" and gets reported as flakiness.

`path` is the dotted path the API answers errors against, minus the `body.`
prefix — so `address.city` matches `body.address.city`.

### `{ key: 'tagline', label: 'Tagline', path: 'tagline', mono: false, wide: true }`

The two fields written for a reader rather than for a form (**R32**), so
they are the two laid out differently: full width while editing, and
stacked and left-aligned rather than right-aligned while reading.

They replace `About`, which was the last box on the platform reading a
paragraph the product stopped collecting — **R25** took it off the public
portfolio and **R26** off onboarding and off the dealer's own profile
screen. Showing a reviewer prose nobody will read, and _not_ showing them
the sentence that will front the dealership's public page, was reviewing
the wrong field.

The reviewer's reason for being able to edit them is exactly the reason
`About` was editable: these are free text a dealership typed and a buyer
will read, which makes them where a phone number gets smuggled onto a
public page. That is what rule 7 exists to catch, and this is the screen it
gets caught on.

### `list: true`

A list in the schema, one comma-separated box on the screen — the same
shape the dealer's own profile form uses, so a moderator and a dealer are
editing the field in the same vocabulary. `list: true` is what tells the
patch to split it back apart; without it the API would be sent a string
where `UpdateDealerInput` wants an array, and `.strict()` would answer
400 rather than writing something wrong.

### `function patchOf(values: Values, initial: Values): Record<string, unknown>`

The dotted paths that changed, folded back into the nested shape the schema
wants. An unchanged field is absent rather than sent as itself — see the note
on the component above.

### `function errorFor(errors: Record<string, string>, path: string): string | undefined`

`body.address.city` → the `address.city` row. Also matches a bare leaf.

And an index beneath the path (**R32**): a refusal about one entry in a list
arrives as `body.specialities.3`, which none of the four exact lookups match.
Without the last clause the box a moderator has to fix is the one box with no
message on it — the form says "those changes did not save" and nothing says
which of eleven services is sixty-one characters long.

### `const [source, setSource] = useState(dealer)`

What the API last said, as the baseline the diff is taken against.

Re-derived during render when the prop changes rather than in an effect,
because `router.refresh()` after a save delivers the new dealership as a
render: reconciling in an effect would leave one paint in which the form
still holds the values the _previous_ save was diffed from, and the next
edit would be diffed against a stale baseline.

### `router.refresh()`

The server re-reads the dealership; `source` above picks the new values

### `router.refresh()`

up on the render that follows.

### `<div`

A sentence and a row of chips do not belong in the
label-on-the-left, value-on-the-right rhythm the rest of the list
keeps: at 13px a tagline wraps to two ragged right-aligned lines
and a service list to three. Stacked and left-aligned, they read
the way they will read on the dealership's public page — which is
the thing the reviewer is actually being asked to judge.

### `servicesOf(initial[field.key]).length > 0 ?`

As chips rather than as the comma string the box holds.
A moderator is comparing this against the public page,
where they are chips, and the shape is what makes a
dealership that typed one seventy-word "service" obvious
at a glance rather than on a character count.

### `{field.key === 'contactPhone'`

The phone is shown formatted while it is being read and raw
while it is being edited — `+91 98400 12345` is what a reviewer
is checking against a letterhead, and `9840012345` is what the
field accepts back.

## `apps/web/src/features/admin/document-review.tsx`

### `const DOC_TONE: Record<AdminDealerDetail['documents'][number]['status'], StatusTone> =`

D5 — the KYC decision, on the row it is about.

The endpoints have existed since F044 and nothing called them, which had a
consequence beyond the missing buttons: approving a dealership requires all
three documents `VERIFIED`, so with no way to verify one from the console the
approve control could never appear. This is the other half of that fix.

A rejection reason is mandatory and is shown to the dealer verbatim — it is
what they re-upload against, so "rejected" on its own costs a round trip.

**Rejecting a document is not rejecting the dealer**, and the copy on this
row says so, because the word is the same and the consequence is not. It
rejects one _file_: the scan is deleted from storage, the row is emptied so
the dealer sees the slot they saw before they uploaded, and the application
is handed back to them as a draft so they can reach the upload box at all.
The other two documents are untouched. The control that rejects a
_dealership_ is in `DealerAdminActions` below, it is behind a confirmation,
and it deletes everything.

### `dealerSlug: string`

The dealership these documents belong to, for cache invalidation only.

Rejecting one can hand a PENDING_APPROVAL application back to DRAFT, and a
dealership that is not ACTIVE is not public — so a decision here can remove
a portfolio from the marketplace, and the cached copy has to go with it.

### `const decidable = document.status === 'UPLOADED'`

Only a document that has actually been uploaded can be decided on. A

### `const decidable = document.status === 'UPLOADED'`

REQUIRED row has no file behind it, and a decided one is re-decided by the

### `const decidable = document.status === 'UPLOADED'`

dealer re-uploading, not by a moderator changing their mind in place.

### `const decidable = document.status === 'UPLOADED'`

A REJECTED row is now genuinely empty — the file was deleted when it was

### `const decidable = document.status === 'UPLOADED'`

rejected — which is why it reads the same as REQUIRED here and to the

### `const decidable = document.status === 'UPLOADED'`

dealer: a slot waiting for an upload, with the reason underneath.

### `{document.viewUrl ?`

`viewUrl` is short-lived and audit-logged — it is the only
way a KYC document is ever read (D5).

### `<Button variant="ghost" size="sm" onClick={() => setRejecting((open) => !open)}>`

"Reject file", not "Reject" — the word on its own is the one
that gets read as a verdict on the dealership.

### `<p className="w-full text-[12px] ink-muted">`

The consequence, stated before the button is pressed. It is not a
verdict on the dealership — but it does delete a file and reopen the
application, and both are surprising if unannounced.

## `apps/web/src/features/admin/profile-change-review.tsx`

### `export function ProfileChangeReview({ change }: { change: AdminProfileChange })`

D3b — the review card for a dealer's proposed tagline and service list
(**R34**).

## What it is guarding

These two fields are the only free text a dealer writes that a buyer reads.
Everything else on their profile screen has been read-only since R27, and
these were left editable because a dealership is entitled to revise how it
describes itself. That leaves exactly one route by which a phone number can
reach a public page without passing `POST /v1/vehicles/:id/reveal-contact` —
the one endpoint allowed to hand one out, rate-limited twice over and logged
as a lead. This card is where that gets caught.

A moderator reading it is not asking "is this a nice tagline". They are
asking whether it contains a number, a URL, a rival's name, or a claim the
platform would be repeating on the dealership's behalf.

## Old beside new, always

The live value is rendered next to the proposed one because the question is
_"is this change acceptable"_ rather than _"is this sentence acceptable"_, and
the two differ whenever the edit is a small correction to a line that was
already approved. A card showing only the proposal makes the reviewer hold the
old value in their head, and a reviewer holding a value in their head is one
who approves a number appended to a sentence they half-remember.

A field the request does not touch says so rather than rendering blank — an
empty row under "Services" reads as _they are clearing their services_, which
is the opposite of what `[]` means here.

## The refusal needs a sentence, and the button says so

`Refuse` is disabled until there is a reason of substance behind it, the way
suspension is. The dealer reads that sentence verbatim on their own profile
screen and it is the only account they will get of why their line did not
appear — "rejected" with nothing attached is how a dealer concludes the
product is broken and submits the same text again.

Neither decision is behind a confirm step. Both are reversible in the way that
matters: a refused edit can be resubmitted by the dealer in a minute, and a
wrongly published one can be edited back. That is a different category from
`Reject dealership`, which destroys an application, and it should not be
dressed up as though it were the same.

### `router.refresh()`

The card disappears on the next render: `profileChange` is PENDING-only,

### `router.refresh()`

so a decided edit is simply no longer there.

### `function Comparison<T>(`

Now, and what it would become.

`proposed === null` is the case worth the branch: it means _this request does
not touch this field_, and it has to read as **unchanged** rather than as
cleared. Rendering an empty row would tell the moderator the dealer wants
their services removed, and approving that reading would be approving
something nobody asked for.
