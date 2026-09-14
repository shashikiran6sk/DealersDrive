# api / modules/admin

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/admin/admin.docs.ts`

### `export const adminDocs: ModuleDocs =`

D1–D15. The platform's own console.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline documents 20 operations. This file grows with the router beside
it — an operation lands in the same PR that mounts its route, which is what
`tests/unit/docs/openapi.test.ts` checks in both directions. F049 brought the
first — the metrics the console shell reads — F044 the two KYC review paths,
and **F045 the six dealer paths**. `grantDealerCredits` is not among them: it
moves credits, so it lands with the ledger.
────────────────────────────────────────────────────────────────────────────

## `apps/api/src/modules/admin/admin.messages.ts`

### `export const DEALER_NOT_FOUND = 'That dealership does not exist.'`

Said by six of this module's decisions, and by nothing outside it.

## `apps/api/src/modules/admin/admin.routes.ts`

### `const ROUTES: AdminRoute[] = [`

D1–D15. Every write in this router is audit-logged with the admin identity.

This router deliberately carries **no** `requirePermission` middleware, and
that is worth being explicit about rather than reading as an omission. An
admin action's permission is checked inside `admin.service.ts`, in the same
function that performs it. Putting the check there rather than here means it
cannot be bypassed by a second caller reaching the service another way, and it
keeps the permission next to the audit row it justifies.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline declares 20 routes. F049 mounted the first, which is also the one
the console shell reads on every page, and F044 the two KYC review paths.
**F045 brings the six dealer paths** — bar `POST /dealers/:id/credits/grant`,
which moves credits and so waits for the ledger at F050/F054. The listing
queue, payments, configuration and the audit log belong to later tiers.
────────────────────────────────────────────────────────────────────────────

## `apps/api/src/modules/admin/admin.service.ts`

### `export interface AdminDeps`

D1–D15. The platform's own console.

This is the one module that reads across tenants, and it does so
deliberately: every write records who did it, and the permission table (§8.3)
is narrower than "is an admin" — granting credits and changing configuration
are SUPER_ADMIN only, while a SUPPORT admin can read metrics and nothing
else.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline file is ~1,320 lines across metrics, dealer moderation, KYC
review, the listing queue, credit grants, payments, configuration and the
audit log. F049 brought `overview()` — the one method the console shell
needs, because the shell's guard _is_ that request — and **F044 the KYC
review**, which brings `AuditService` with it.

**F045 brings the dealer status machine** — the list, the detail screen and
the four decisions. Everything after that belongs to tiers 8 and 11.
────────────────────────────────────────────────────────────────────────────

### `dealers: DealersService`

The dealer service, for the one write the console makes into a dealership's
own data (D3 edit).

It is taken as a dependency rather than reimplemented because everything
that makes `PATCH /v1/dealer` correct has to hold for the admin path too:
locality normalisation, the E.164 rewrite that the phone's unique index is
an index _over_, the name-within-a-city duplicate check, and writing
`brandName` from `legalName` so the display mirror cannot drift. A second
copy of that would be a second set of rules, and the two would disagree.

### `const REQUIRED_DOCUMENTS = 3`

The three documents KYC needs. A dealership is verified when all three are.

### `function toAdminProfileChange`

One proposed edit, with what is live beside it (**R34**).

The live values travel with the proposed ones because the question a
moderator is answering is not "is this tagline acceptable" — it is "is this
_change_ acceptable", and the two differ whenever the edit is a small
correction to a line that was already approved. A screen showing only the
proposal makes the reviewer hold the old value in their head, and a reviewer
holding a value in their head is one who approves a number appended to a
sentence they half-remember.

`now` is a parameter so the waiting label is computed against one clock for
a whole queue rather than drifting a second down the page.

### `liveSpecialities: distinctServices(dealer.specialities)`

Collapsed on the way out, as everywhere else they are read (**R18**), so

### `liveSpecialities: distinctServices(dealer.specialities)`

a moderator is not shown a repeat the public pages would have merged.

### `async function locationFacets(): Promise<AdminDealerFacets>`

Every location a dealership actually sits in, for the console's filters.

`distinct` on the column rather than a table of places, because there is no
table of places any more — D1 removed it, and the values here were typed by
dealers and normalised on write. Nulls are dropped and the result is sorted
so the select reads alphabetically.

### `function assertPermission(admin: AdminPrincipal, permission: string): void`

The permission check lives here rather than in the router, in the same
function that performs the action — so it cannot be bypassed by a second
caller reaching the service another way, and it stays next to the audit row
it justifies.

### `async function requirePendingChange(changeId: string)`

A profile edit that is still waiting for an answer, with its dealership
(**R34**).

The two failures are told apart on purpose. A change id that does not exist
is a 404; one that has already been decided is a 409, and it is the case
that actually happens — two moderators working the same queue, or one with
the page open in two tabs. Answering the second with a silent success would
show a tick for a button that did nothing, and answering it with a 404
would send them looking for a row that is right there.

### `async overview(admin: AdminPrincipal): Promise<AdminOverview>`

D1. The console landing page, and the shell's authorization check in one
request: every admin page sits under a layout that awaits this, so a 401
here is what redirects to sign-in.

### `const activeListings = 0`

── Reconstruction slice ──────────────────────────────────────────────
The baseline resolves five more counters in the same `Promise.all`:
approved and pending-review `Listing`s and the oldest of them
(**F064**), captured `Payment` totals (**F052**) and NEW `Enquiry`
count (**F088**). None of those models exists yet.

With no rows to count, zero is the true answer rather than a
placeholder — but it is not the baseline's code, and each query is
restored with its model. The GST split below is kept because it is the
part that is easy to get wrong later: `payments30d` is gross captured
and `revenue30d` is net of GST, and reporting one as the other is the
kind of mistake that reaches a board deck.
──────────────────────────────────────────────────────────────────────

### `async dealers(query: AdminDealerQuery): Promise<AdminDealersResponse>`

─────────── D2–D4 dealers ────────────────────────────────────────────

### `async dealers(query: AdminDealerQuery): Promise<AdminDealersResponse>`

D2. Every dealership, filterable and cursor-paginated. `counts` carries a
total per status so the status tabs do not need a second request.

### `const where =`

The three location filters, `AND`ed.

Each is the dealership's own text now rather than a slug on a joined
row, and each is matched case-insensitively — a filter built from one
dealership's `Vellore` still finds another's `vellore`. Combining them
is what makes the console usable at scale: a state narrows to a few
hundred, a district to a few dozen, a town to the one being asked
about.

### `...(query.pendingEdits === 'true'`

The dealerships waiting on a decision about their own words
(**R34**).

A relation filter rather than a denormalised flag on `dealers`: the
queue is small — one row per dealership with an edit in flight — and
a boolean column would be a second copy of the same fact, kept in
step by every path that decides one. The index this rides on is
`(status, createdAt)` on the change table.

### `profileEdits: { where: { status: 'PENDING' }, select: { id: true }, take: 1 }`

Only whether there is one, not what it says — the row renders a

### `profileEdits: { where: { status: 'PENDING' }, select: { id: true }, take: 1 }`

badge and the detail screen is where it is read.

### `const activeByDealer = new Map<string, number>()`

── Reconstruction slice ──────────────────────────────────────────────
The baseline pulls `_count: { vehicles: true }` into the same query and
groups `Listing` by dealer for the APPROVED count. Neither model exists
before **F055** and **F064**, so both columns read zero here — the true
answer while there are no rows, and restored with the models rather
than approximated now. Everything else on the row is the baseline's.
──────────────────────────────────────────────────────────────────────

### `const facets = await locationFacets()`

The filter's own options, read off the rows rather than kept in a list
somewhere. Three cheap `DISTINCT`s: the whole table is the domain of
the filter, so they are deliberately _not_ narrowed by `where` —
picking a state must not empty the district select and strand the
console with no way back.

### `async dealerDetail(admin: AdminPrincipal, dealerId: string): Promise<AdminDealerDetail>`

D3. One dealership with everything a decision needs on a single screen —
including an `actions` block, so the console never re-derives the state
machine and two admins cannot reach different conclusions about the same
dealership.

### `profileEdits: { where: { status: 'PENDING' }, take: 1 }`

PENDING only (**R34**). A decided edit is history: the review card

### `profileEdits: { where: { status: 'PENDING' }, take: 1 }`

has nothing to offer about it, the dealer reads the refusal on

### `profileEdits: { where: { status: 'PENDING' }, take: 1 }`

their own screen, and the audit log is where a past decision lives.

### `const active = 0`

── Reconstruction slice ──────────────────────────────────────────────
The baseline resolves four more numbers here: `_count` of `Vehicle`
(**F055**) and `Enquiry` (**F088**), APPROVED and PENDING_REVIEW
`Listing` counts (**F064**), and the last eight `CreditTransaction`
rows (**F050**). The screen renders all four, so they stay in the
response shape and read empty until the models exist.
──────────────────────────────────────────────────────────────────────

### `const documents = await Promise.all`

Every signed document URL issued is audit-logged with the admin's

### `const documents = await Promise.all`

identity — that is the whole access control on KYC media (§26.6).

### `const yardPhoto = dealer.coverMediaId`

The yard photograph, signed the same way a document is.

A moderator has to be able to see it. "Is this a clear photograph of
the premises, or is it a screenshot of a logo" is the question the
requirement exists to ask, and it is not one the API can answer.

### `specialities: distinctServices(dealer.specialities)`

Collapsed on the way out, as on every other surface that reads them
(**R18**). A moderator looking at "Finance, finance" would reasonably
correct it — and would be correcting something no buyer ever sees,
because the public pages merge repeats too. What is shown here is
what a buyer gets.

### `canApprove: dealer.status === 'PENDING_APPROVAL' && allVerified`

Approval needs both: an application waiting, and the documents
behind it verified. The console renders the control whenever the
first is true and disables it on the second — `allDocumentsVerified`
is on this response, so it can say _why_ rather than showing
nothing at all. A screen with no button on it reads as a broken
screen, and that is how this was being reported.

### `canReject: dealer.status === 'PENDING_APPROVAL' || dealer.status === 'DRAFT'`

Rejection destroys the application (see `rejectDealer`), so it is
offered only while there is nothing behind the dealership to
destroy — before it has ever been approved. An ACTIVE dealership
that has gone bad is suspended, which is reversible; a SUSPENDED
one has already been dealt with.

### `canRequestChanges: dealer.status === 'PENDING_APPROVAL'`

Sending it back is available from exactly the state where the
dealer cannot otherwise act: PENDING_APPROVAL shows them the "we
are reviewing this" panel and no form. From DRAFT they can already
edit everything, so there is nothing to reopen.

### `async approveDealer`

D4. ACTIVE is what makes a dealership's listings eligible to appear
publicly at all (rule 6), so this is the single most consequential write
in the console.

── Reconstruction slice ────────────────────────────────────────────────
The baseline seeds an onboarding bonus here when `grantCredits` is given,
through `moveCredits`. Rule 4 says every credit movement writes a
`CreditTransaction`, and neither the model nor `billing.facade.ts` exists
until **F050** — so the field is absent from `ApproveDealerInput`, which
is `.strict()` and therefore names it in a 400 rather than accepting it
and quietly moving nothing. `creditsGranted` stays in the response and
reads zero; the grant returns with the ledger that can honour it.
────────────────────────────────────────────────────────────────────────

### `async rejectDealer`

D4 reject — and it is a **purge**, not a status change.

A rejection says "this is not a dealership we will trade with", and the
product's answer to that is to keep nothing: the three KYC scans and the
yard photograph are deleted from object storage, and the `dealers` row
goes with them — taking its documents and its OWNER membership by
cascade. The person keeps their verified Google account and nothing else,
so signing in again finds no membership and drops them at step one of
onboarding as a first-time applicant.

**This is the destructive answer, and it is the rarer one.** A moderator
who wants a clearer GST certificate, or the legal name spelt as it is on
the PAN card, wants `requestChanges` below — which keeps every field the
dealer typed and merely reopens the form. Rejecting instead would cost a
real business its whole application over a blurry photograph, and the two
controls are separated in the console for that reason.

Three things make the destruction safe to reason about:

· **The audit row outlives the dealership.** `audit_logs.dealerId` is a
column, not a foreign key, so the record of who rejected what, when
and why survives the row it refers to. It is written before the
delete for the same reason.
· **Storage is emptied before the rows are.** The row is the only thing
that knows where the bytes are — a KYC scan's key ends in its
document id. Delete the row first and the scan of somebody's PAN card
stays in the bucket with nothing left pointing at it, which is a
retention problem rather than a housekeeping one.
· **Only an unapproved application can be rejected.** `canReject` is
DRAFT or PENDING_APPROVAL, so there is never a listing, a payment or
a buyer's enquiry hanging off the row being removed. An ACTIVE
dealership that goes bad is _suspended_, which is reversible.

### `const media = await prisma.media.findMany({ where: { dealerId } })`

Every object this dealership put in the bucket: the KYC scans, whose
keys are derived from the document rows, and the media rows — the yard
photograph, and a logo if one was ever uploaded — which carry their own
`storageKey`.

### `const removals = await Promise.allSettled(keys.map((key) => storage.delete(key)))`

`allSettled`, and the count is of what actually went.

A key that is already gone — a document row whose upload never
completed — must not abort the purge and leave the dealership
half-destroyed. What matters is that the rows are removed; an object
left behind is reconcilable from the audit row, and a `dealers` row
left behind is a dealership the applicant can still sign into.

### `await audit.record(tx`

Written first, and with the whole record in `before`, because in a

### `await audit.record(tx`

moment there will be nothing left to describe it.

### `recipientEmail: owner?.email ?? dealer.contactEmail`

The membership is deleted with the dealership. Keep the actual

### `recipientEmail: owner?.email ?? dealer.contactEmail`

notification recipient in the surviving audit snapshot so the

### `recipientEmail: owner?.email ?? dealer.contactEmail`

worker can still send after the purge commits.

### `payload: { dealerId, reason }`

Ids and the reason, and no PII — the same rule every other payload
follows, and it holds here even though the handler cannot re-fetch
the dealership afterwards. The outbox is a durable table that
outlives the row it describes; putting an applicant's name and
email into it is exactly the thing a rejection is supposed to
remove. The `before` block on the audit row above is where a
notification handler reads what it needs.

### `await tx.dealer.delete({ where: { id: dealerId } })`

`dealer_documents` and `dealer_members` are `onDelete: Cascade`.

### `async requestChanges`

D4 request changes — the reversible refusal, and the one a moderator
reaches for far more often than rejection.

PENDING_APPROVAL → DRAFT with the reason attached. Nothing is deleted:
every field the dealer typed, every document they uploaded and the yard
photograph all stay exactly where they are. What changes is that the
application is _theirs_ again — the onboarding screen stops showing the
"we are reviewing this" panel and reopens the form, filled in, with the
reason at the top of it.

The status is the only mechanism that can do this. A dealership is
blocked from editing while PENDING_APPROVAL precisely so that a moderator
is not reviewing a moving target; handing it back means giving up that
guarantee, deliberately, and taking the application out of the queue at
the same time.

### `async updateDealer`

D3 edit — the console amending a dealership's own answers.

A moderator reading a GSTIN off a certificate can see that the dealer
typed one digit wrong, and the alternative to fixing it here is a round
trip that costs a working day to correct a character. So the console can
write the same fields the dealer can.

It goes through `dealers.update` rather than touching `prisma.dealer`
directly, and that is the whole design: locality normalisation, the
E.164 rewrite, the name-unique-within-a-city check and the `brandName`
mirror are all rules about the _data_, not about who is editing it. An
admin path with its own copy of them would be an admin path that drifts.

The audit row is what the dealer path does not have, and is the reason
this is not simply the same endpoint: an edit a dealer did not make must
be attributable to the person who made it.

### `after: input`

The fields the admin actually sent, rather than the whole row after

### `after: input`

the write: a diff nobody has to compute is a diff nobody gets wrong.

### `async suspendDealer`

Suspension pulls every listing out of the catalogue immediately (D4).

### `async setDealerStatus`

The two reversible moves, in one function: suspend and reinstate.

REJECTED is deliberately not reachable here any more. It used to be the
third case, and that was what made rejection look like a status change —
`rejectDealer` now destroys the application rather than labelling it, and
the union below is narrowed so the old path cannot be walked by accident.

### `const listings = 0`

`Listing` arrives with F064; until then no listing can be affected,

### `const listings = 0`

which is why this reads zero rather than being left out of the shape.

### `await setSeatStatus(tx`

The **dealer seat**, not the account (**R41**).

### `await setSeatStatus(tx`

This used to write `users.status`, which is the whole person: a

### `await setSeatStatus(tx`

member who also moderates the platform lost the admin console

### `await setSeatStatus(tx`

because a dealership in Vellore was suspended. The seat is the

### `await setSeatStatus(tx`

right unit — it closes the door this decision is about and leaves

### `await setSeatStatus(tx`

every other one alone.

### `await tx.session.updateMany(`

Scoped to DEALER for the same reason. An admin session held by

### `await tx.session.updateMany(`

one of these people survives; their dealer console does not.

### `await tx.session.updateMany(`

Reinstatement never un-revokes these rows — the person signs in

### `await tx.session.updateMany(`

again, which is how the seat check runs afresh.

### `...(status === 'SUSPENDED' ? { reason } : {})`

The dealer needs the suspension reason. A reinstatement note is

### `...(status === 'SUSPENDED' ? { reason } : {})`

explicitly internal in the API contract and does not leave the

### `...(status === 'SUSPENDED' ? { reason } : {})`

admin surface.

### `async verifyDocument`

─────────── D5 KYC review ────────────────────────────────────────────

### `async rejectDocument`

D5 reject — "send me this one again", not "you are not a dealership".

This is the narrowest of the three refusals in the console and the
distinction is load-bearing, because the word is the same and the
consequence is not. Rejecting a _document_ rejects a file: the scan is
unreadable, or it is last year's electricity bill, or it is a photograph
of the wrong page. The other two documents are untouched, the dealership
is untouched, and the only thing being asked for is one upload.

Two things follow from that, and both are done in `reviewDocument`:

· **The file is deleted from storage.** Keeping a rejected scan of
somebody's PAN card serves nothing — it will never be read again,
because the dealer is about to replace it — and KYC media is exactly
the category where "we still had a copy" is the wrong answer. The row
survives, because the checklist is three fixed rows, but it survives
empty: no file name, no media id, no readable object behind it. The
dealer sees the slot they saw before they ever uploaded, with the
reason underneath saying what to send instead.
· **The application is reopened.** A PENDING_APPROVAL dealership is
shown the "we are reviewing this" panel and no form, so a dealer told
to re-upload could not reach the upload box. The rejection therefore
returns the dealership to DRAFT — which is the same thing
`requestChanges` does, because it _is_ a request for changes, scoped
to one document.

### `...(rejecting ? { fileName: null, mediaId: null } : {})`

A rejected document keeps its row and loses its file. Clearing

### `...(rejecting ? { fileName: null, mediaId: null } : {})`

these two is what makes the dealer's checklist render an empty

### `...(rejecting ? { fileName: null, mediaId: null } : {})`

slot rather than a file name they can no longer open.

### `const dealer = await tx.dealer.findUnique({ where: { id: doc.dealerId } })`

Hand the application back so the re-upload is possible at all.

Scoped to PENDING_APPROVAL: a DRAFT dealership is already editable,
and an ACTIVE one is not in the onboarding flow — a document
rejection against a trading dealership is a compliance matter for
suspension to answer, not a reason to drop it back into onboarding.

### `key: dealer ? documentKey(dealer.slug, doc.type, doc.id) : null`

`dealer` is the row `doc.dealerId` points at, read above; the

### `key: dealer ? documentKey(dealer.slug, doc.type, doc.id) : null`

foreign key makes it present, and the fallback is there only

### `key: dealer ? documentKey(dealer.slug, doc.type, doc.id) : null`

because Prisma's type cannot know that.

### `if (rejecting && outcome.key) await storage.delete(outcome.key)`

The bytes go after the transaction commits, not inside it.

Object storage cannot be rolled back. Deleting first and then failing
to commit would leave a row saying UPLOADED with nothing behind it —
the one state the dealer cannot recover from, because the checklist
would offer "Replace" for a file that is not there. Doing it this way
risks the opposite and much cheaper failure: an object nothing points
at, which a sweeper reconciles.

### `async profileChanges(admin: AdminPrincipal): Promise<AdminProfileChangesResponse>`

─────────── D3b profile edits awaiting review (R34) ──────────────────

### `async profileChanges(admin: AdminPrincipal): Promise<AdminProfileChangesResponse>`

The queue, oldest first.

Oldest first and not newest: this is work, and the dealership that has
been waiting longest is the one a moderator owes an answer to. The
dealer's own screen shows nothing but "waiting for review" in the
meantime, so the wait is the whole of their experience of it.

`admin:dealer:approve` rather than a permission of its own. The judgement
is the same judgement — is this dealership saying something acceptable to
a buyer — and a seat trusted to approve a dealership onto the platform is
trusted to approve a sentence it writes. A separate permission would be a
second thing to grant and a second thing to forget.

### `const now = new Date()`

One clock for the whole page, so two rows submitted in the same second

### `const now = new Date()`

do not report different waits because the loop took a moment.

### `async approveProfileChange`

Publish it.

The write is the only place `dealers.tagline` and `dealers.specialities`
move on an ACTIVE dealership, which is what makes the queue a real gate
rather than a notification: there is no second path, so an edit that was
not approved was not published.

It goes through `dealers.update` rather than touching the columns, for
the reason `updateDealer` does — `distinctServices` and every other rule
about the _data_ lives there, and an admin path with its own copy is an
admin path that drifts. The moderator is agreeing to the dealer's words,
not typing them again.

A rejected or already-approved request is a 409 rather than a silent
success. Two moderators opening the same queue is the ordinary case, and
the second one must be told their button did nothing rather than shown a
tick.

### `await dealers.update(change.dealerId`

`null` and `[]` mean "this request does not touch that field", so they
are omitted from the patch rather than sent as themselves. Sent, they
would be a 400 — the schema floors are ten characters and one entry —
which is the right refusal for a dealer and the wrong outcome here: a
moderator approving a services-only edit would be told their tagline
was too short.

### `async rejectProfileChange`

Refuse it, and say why.

**Nothing is restored, because nothing was taken away.** The live columns
were never written, so a refusal is a status change on the request and no
write at all on the dealership — which is what makes this operation safe
to get wrong. A design that published first and rolled back on refusal
would have a window, however short, in which the phone number was on the
page; this one has none.

The reason is required and is shown to the dealer verbatim. It is the
only thing they will ever be told about why their line did not appear,
and "rejected" with no sentence attached is how a dealer concludes the
product is broken and edits it again the same way.

### `before: { tagline: change.tagline, specialities: change.specialities }`

What was refused, so the trail records the words as well as the

### `before: { tagline: change.tagline, specialities: change.specialities }`

verdict. A rejection whose text is gone cannot be reviewed later.

### `async config(admin: AdminPrincipal): Promise<ConfigResponse>`

─────────── D14 configuration (F072) ─────────────────────────────────

### `async config(admin: AdminPrincipal): Promise<ConfigResponse>`

Every setting, including the ones `GET /v1/config/public` withholds.

`readBy` is what makes the screen honest: the table holds every knob the
product will ever have, and most of the code that consults them has not
been reconstructed. A key nothing reads is shown read-only rather than
hidden — "what will the listing duration be" is a fair question — and
`CONFIG_READERS` beside the defaults is the one place that answers it.

### `async setConfig(admin: AdminPrincipal, key: string, value: unknown): Promise<ConfigResponse>`

One key, one value, one audit row.

The type check is the part the baseline documents and does not perform.
`PlatformConfig.value` is JSON, so a string where a number belongs is
stored happily and read back by `config.number()` as `NaN` — which
surfaces days later as a GST figure nobody can explain. The declared type
is already on the row; comparing against it costs one function.

### `async adminAccess(admin: AdminPrincipal): Promise<AdminAccessResponse>`

─────────── who may open this console (R42) ──────────────────────────

### `async adminAccess(admin: AdminPrincipal): Promise<AdminAccessResponse>`

Everybody who can sign in to the admin console, from both directions.

Two sources, and the list would be lying if it showed only one.
`ADMIN_ALLOWLIST` is the deployment's answer and is checked on every
request; a **grant** is a `user_roles` row with `grantedBy` set, made
here by a SUPER_ADMIN. An allow-listed address nobody has signed in with
yet has no row at all, and still appears — with a null `userId`, because
there is nothing to address it by until they arrive.

### `const granterIds = [`

One read for every granting admin's address, rather than one per row.

### `if (!allowlisted && !granted) continue`

A row that is neither allow-listed nor granted is somebody whose

### `if (!allowlisted && !granted) continue`

access has already been withdrawn. It is history, not access.

### `for (const email of env.adminAllowlist)`

The allow-listed addresses nobody has signed in with yet.

### `async grantAdminAccess`

Hand somebody a seat.

The row is created if the address is new to the platform, which is the
ordinary case — a colleague who has never signed in. They still sign in
with Google; this is what makes the console let them past the door when
they do, and `completeAdminGoogle` links the Google identity onto this
row the first time.

Granting is also how a withdrawn seat is restored, so the update reopens
a suspended one. That is a deliberate act by a SUPER_ADMIN either way.

### `async revokeAdminAccess(admin: AdminPrincipal, userId: string): Promise<void>`

Take a seat back.

Three refusals, and each of them is a door somebody could otherwise walk
through and not walk back out of:

**Your own seat.** There may be nobody left who can let you back in.
**An allow-listed address.** The environment is what admits them, and a
control that appeared to change that and did not would be worse than
none.
**A seat nobody granted.** Every admin sign-in leaves an ADMIN seat
behind (**R41**); only a grant carries `grantedBy`, and only a grant is
this screen's to withdraw.

### `await tx.session.updateMany(`

Their console closes on the next click, not at the next expiry. The

### `await tx.session.updateMany(`

dealer seat, if they hold one, is untouched — this is R41 read in the

### `await tx.session.updateMany(`

other direction.

### `function configEntry(entry: ConfigDefinition): ConfigResponse['data'][number]`

A config row as the console reads it.

`updatedAt` is null here, as it is in the baseline: `PlatformConfigService`
answers with the resolved value and its declared type, and does not carry the
row's timestamp. The console renders "last changed" only when there is one.

### `function matchesDeclaredType(type: ConfigDefinition['type'], value: unknown): boolean`

Does this value match what the key says it is?

`PlatformConfig.value` is a JSON column, so it will store anything: a string
where a number belongs is written happily, and read back by `config.number()`
as `NaN`. That surfaces days later as a GST figure nobody can account for,
which is why this is a 422 at the door rather than a mystery in a report.

### `function compactRupees(paise: number): string`

₹1.2 Cr rather than ₹12,00,00,000 — a stat tile has one line to work with.
