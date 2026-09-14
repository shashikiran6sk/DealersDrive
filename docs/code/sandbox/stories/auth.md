# sandbox / stories/auth

Parent: [sandbox](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/sandbox/src/stories/auth/auth-shell.stories.tsx`

### `const meta =`

DESIGN-SPEC §3.9 — the shell every authentication screen sits in.

Three pages use it: dealer sign-in (F018), dealer onboarding (F037) and the
admin console login (F019). `/admin/login` lives under a different route
segment from the other two, which is exactly why this is a component and not
a route layout — a shared component crosses that boundary where a layout
cannot.

The white field behind the column is the `(auth)` route layout's, not this
component's, so the decorator below supplies it. Without it the shell renders
on Storybook's default ground and looks nothing like the real screen.

### `export const Playground: Story = {}`

The default eyebrow — what a dealer sees at `/dealer/login`.

### `export const CustomEyebrow: Story = { args: { eyebrow: 'Dealers-Drive admin' } }`

The admin console overrides the eyebrow. It is the only visible difference
between the two sign-in screens above the fold, so it has to be legible.

### `export const HeadingWithAndWithoutSubtitle: Story =`

The heading on its own, with and without the 15px subtitle line.

## `apps/sandbox/src/stories/auth/document-uploader.stories.tsx`

### `function document(overrides: Partial<DealerDocumentDto> = {}): DealerDocumentDto`

DESIGN-SPEC §3.10 step 3 — one KYC document row (C041).

**P0 in `component-sandbox.md`, and this is why**: the row has seven states,
five of them decided by the API and two by the browser, and until now none of
them could be seen without a real S3 bucket and a real rejection from a real
moderator. Every state below is a prop.

The upload itself is presign → PUT straight to storage → commit. The file
never passes through the Next server; only the signing and commit calls are
proxied, because those need the session. There is no network here, so the
_uploading_ and _failed_ states are the two that stay out of reach — pressing
Upload in the sandbox opens a file picker and then fails at `fetch`, which is
honest rather than useful.

**Delete appears on any row with a file behind it**, and Replace is a delete
and an upload rather than a second object left in the bucket. The stored
object's key ends in the row's id, so both paths have to know which id they
are displacing before they overwrite it — the delete-the-prefix shortcut the
baseline used removed nothing at all.

KYC documents are private. There is no public delivery route for them at all
— an admin reads one through a short-lived signed URL, and every issue of one
is audit-logged (§26.6). That is why no story here shows a thumbnail.

### `export const Required: Story = { args: { document: document() } }`

Nothing uploaded. The sub-line carries the rules rather than the tag — a tag
is a state, not a sentence, and "Required — PDF or JPG, max 5 MB" would push
the row over its width.

### `export const InReview: Story =`

Uploaded, waiting on a moderator. The action becomes Replace, not Upload.

### `export const Verified: Story =`

Verified. The type prefix in the tile is replaced by a tick.

### `export const Rejected: Story =`

Rejected, with the reason in place of the file name.

This is the state that justifies the whole row rendering its own sub-line: a
dealer who reads `REJECTED` learns nothing, and a dealer who reads "Too
blurry to read" knows exactly what to send next.

### `export const Uploading: Story =`

A presign was issued and the PUT has not been confirmed yet.

### `export const UploadedAndRemovable: Story =`

Uploaded, seen for the Delete button rather than for the tag.

A row with a file behind it offers to remove it outright, not only to swap
it. A dealer who uploaded their PAN into the address-proof slot had no way
to undo that: Replace needs a file to replace it _with_, and there was
nothing else to send.

### `export const TheChecklist: Story =`

The whole checklist, which is how a dealer actually meets it — and the only
way to see that a long rejection reason truncates rather than reflows the
row.

## `apps/sandbox/src/stories/auth/google-button.stories.tsx`

### `const meta =`

The only control on the dealer sign-in screen.

An `<a>`, not a `<button>`: the authorization code flow works by the browser
_navigating_ to Google, and a fetch could not carry the redirect. Which is
why `disabled` renders a `<span aria-disabled>` rather than setting an
attribute an anchor does not have — the two stories below are the same
control in both of those shapes.

### `export const Disabled: Story = { args: { disabled: true } }`

What a deployment with no `GOOGLE_CLIENT_ID` shows. Inert on purpose: a
control that looks alive and fails on click is worse than one that says why
it cannot work — the page pairs this with a Banner naming the variables.

### `export const CustomLabel: Story = { args: { label: 'Sign in with Google' } }`

The label is a prop because onboarding says "Continue" and sign-in says "Sign in".

## `apps/sandbox/src/stories/auth/onboarding-wizard.stories.tsx`

### `const NO_YARD_PHOTO: YardPhotoDto =`

DESIGN-SPEC §3.10 — the onboarding wizard (C040).

F037 landed the frame — which step is current, how a step is reached and the
progress indicator. **F038 lands step 1, F039 step 2, F041 step 3, F043 the
outstanding-items list and F042 step 4** — with which the wizard is complete.

`step` is the _server's_ answer, not a preference. The page computes a floor
from the session and clamps `?step=` into it, so the control below stands in
for a session state rather than for a click. The floor is 0 for a DRAFT
dealership and 3 for one already submitted: every step but the first goes
back, which is why steps 1 and 2 have a second write path (`PATCH
/v1/dealer`) behind the same fields.

The wizard calls `useRouter().push` on Back from step 1, which needs the App
Router mock — hence `nextjs.appDirectory`. Without it the story throws on
that click rather than on render, which is the slower kind of failure to
find. It also calls `onboardingAction`, a Server Action, which the sandbox
aliases to `src/mocks/auth-actions.ts` (coupling C-4).

### `const NO_YARD_PHOTO: YardPhotoDto =`

`GET /v1/dealer/yard-photo` with nothing uploaded — step 3's hero slot.

### `function document(overrides: Partial<DealerDocumentDto> = {}): DealerDocumentDto`

One row of the KYC checklist. `DocumentUploader` has its own stories; these place it in context.

### `function completeness(missing: Record<string, string[]> = {}): CompletenessResponse`

`GET /v1/dealer/completeness`. The wizard renders `missing` as words rather
than as the field keys the API answers with — `gstin` becomes GSTIN,
`GST_CERTIFICATE` becomes GST certificate — which is the whole of what the
blocker-list stories are for.

### `const FAKE_PHONE_WIDGET: PhoneOtpWidget =`

`GET /v1/auth/phone/widget` at its local setting (**R39**).

No widget script is loaded on the `fake` driver and no message is sent —
step 1's panel opens and says which digits it will accept. Everything above
the provider, including the refusals, is the production path. `PhoneVerification`
has its own stories for the four states.

### `function session`

A signed-in Google account. `dealer` is null for steps 1 and 2 — no
dealership exists yet — and set for steps 3 and 4, where its `status` is what
decides whether the Review step offers a submit or an under-review panel.

### `phoneVerified: false`

Unproved by default (**R39**). Step 1's forward action is _Send OTP_
until the number on the session is the one in the box, which is the
state a new account is always in.

### `export const Account: Story = { args: { step: 0 } }`

Step 1 — where a Google account with no dealership always lands, with nothing
on the user record yet. Name comes from the Google profile; phone is blank,
because Google does not supply one.

Back leaves onboarding altogether rather than moving within it, because
there is nothing behind step 1. That is the one navigation on this screen
that is not a step change.

### `export const AccountPrefilled: Story =`

The same step for somebody returning: the user record already holds a name
and a phone, and those win over the Google profile. The email does not
change either way — it is shown, not asked for.

### `export const AccountVerified: Story =`

Step 1 with the number already proved (**R39**) — a dealer pressing Back
from the Business step, or returning to a draft.

The forward action is _Continue to business details_ rather than _Send OTP_,
because `phoneVerified` on the session says the number in the box is the one
this account confirmed. **Edit the number and watch it revert**: verification
is a fact about a value, not a flag the page can hold on to after the value
has changed — which is the whole reason `verified` is derived from the
session rather than remembered by the panel.

### `export const Business: Story = { args: { step: 1 } }`

Step 2. Passing `step={1}` is the same picture a dealer reaches by clicking
Continue on step 1, but it is not a state the server ever produces — the
floor is 0 until a dealership exists and 2 once one does, so 1 is only ever
arrived at locally, or re-opened after a rejected submit.

City and State are typed, not chosen. They were a five-row dropdown and a
disabled box beside it, which decided which dealerships could exist rather
than describing the ones that do — a dealer in Salem could not finish this
form, and one in Bengaluru could not be described by it.

The city is load-bearing beyond the address: a dealership's name has to be
unique **within its city**, so both halves of that pair are on this step and
the check is the submit. `BusinessNameTaken` below is that refusal.

The Google Maps link spans both columns. A typed address is not a location —
"18, Gandhi Road" is four pins in one district — so the dealer is asked for
the one that is their gate, and the public portfolio's "Get directions" is an
anchor to exactly this string.

The description is the last field, and on this story it is empty. Press
Continue to watch it refuse: it is required, with a 20-character floor. See
`BusinessWithDescription` for what it looks like filled in.

Continue here is the submit. Press it to watch the ~1s "Creating your
dealership…" state — nothing is written before that press, which is why a
dealer who abandons on step 1 leaves no half-made tenant behind.

### `export const BusinessWithTaglineAndServices: Story =`

The same step for a dealership that already exists, so every box carries the
dealer's own answer — which is what `Back` from the Documents step lands on.

The fields to look at are the last two: **One line about your dealership**
and **Services you offer**. They are asked for here because this is the one
moment a dealer is already describing their business \u2014 a profile screen
offered later is a screen most of them never open.

## They replaced a paragraph, and this story is the before-and-after

The step used to end in **About your dealership**, a multi-line box wanting
two or three sentences. It got one of two things: prose nobody read, or
twenty characters of "we sell used cars" \u2014 the form insisted on prose, and
prose is what a person filling in a sign-up form at the end of a working day
is least able to produce. **R26** replaced it with a line and a list, and
**R33** dropped the column the paragraph was kept in.

A line is a question a dealer can answer, and a list is one they can answer
without writing at all. The line is what the portfolio runs under the name
and what the directory card carries; the services are the only structured
thing a buyer can compare two dealerships by.

Both required, like everything else on this step. The portfolio is the page
a dealership is judged on before anybody drives anywhere, and one with a
photograph, a pin and no sentence reads as an unfinished listing rather than
a business. Compare with `Business` above, where both boxes are empty: the
tagline's floor is 10 characters rather than 1, and the list's is one entry,
because a required field with no minimum is satisfied by `-`.

### `export const ChangesRequested: Story =`

What a dealer sees after a moderator presses **Request changes**.

`statusReason` is only ever set on a DRAFT dealership by one of two things —
that button, or a rejected document — so its presence is what distinguishes
an application that was looked at and handed back from one that was never
finished. Nothing was deleted; that is what the sentence under the note is
for, and it is why _reject_ is a different control with a different outcome.

**The note is set apart from the sentence below it**, and that is the point
of this story. It was a bare paragraph in the same size and weight as the
reassurance under it — two equal-looking paragraphs, only one of which is
actionable. This is the single line on the screen that a person wrote about
_this_ dealership, so it is the line that has to survive being skimmed: a
rule down the left, drawn from `currentColor` so it stays legible in whatever
the banner's tone resolves to, and a heavier weight.

The banner rides above the stepper on every step, not just the first,
because the thing that needs fixing may be three steps along and a banner
that scrolls away with the step is a banner the dealer reads once.

### `export const ChangesRequestedMultiline: Story =`

The same banner carrying two problems rather than one.

A moderator listing two things types them on two lines, so the note renders
`whitespace-pre-line` — a paragraph that silently reflows a numbered list
into one run-on sentence is a paragraph a dealer half-reads and answers half
of. Worth looking at beside `ChangesRequested` above: the accent rule is what
keeps a note this long from reading as body copy.

### `export const BusinessFieldErrors: Story =`

What a rejected submit looks like. The action answers with a banner and
per-field messages, and echoes `values` back so the other eight fields
survive — press Continue to see it.

### `errors:`

All three belong to step 2, deliberately: an error against a step 1

### `errors:`

field sends the wizard back to step 1, which is its own story.

### `export const BusinessNameTaken: Story =`

The duplicate-name refusal, which is what the city on this step is really
for. Press Continue.

Two things to look at. The message names the town — the name on its own is
not the problem, and "Sri Balaji Motors" is a name three unrelated families
use in three different towns. And the banner carries no bullet list under
it: a refusal that already names a field is marked against that field, and
following it with unrelated outstanding items would read as if those were
the problem.

### `export const BlockersMany: Story =`

The blocker list, which is the point of F043. Press Continue: the action
fails, and the banner names each outstanding item in words rather than in the
field keys the API answers with.

Many blockers — the case that has to stay readable, because it is the one a
dealer who abandoned halfway comes back to.

### `export const BlockersOne: Story =`

One blocker. Press Continue.

### `export const BlockersNone: Story =`

None. The banner carries the message alone rather than an empty bullet list —
a failure with nothing outstanding is a different failure, and padding it
with an empty `<ul>` would read as a rendering bug.

### `export const BusinessSubmitting: Story =`

Submitting. The stub holds for a minute so the disabled control and its
"Creating your dealership…" label stay on screen — press Continue.

### `export const PhoneNotVerified: Story =`

**The walk-back.** Press Continue on Business and watch the wizard return to
Account.

A refusal that names `body.phone` is about a field typed on step 1, so the
message used to be rendered against a fieldset the dealer could not see —
leaving them on Business reading a sentence about a box that was not on the
screen. The step follows the error to the field it belongs to, in the same
render, so there is no flicker to catch.

**R39 changed which refusal gets here.** `PHONE_ALREADY_REGISTERED` is now
answered by `POST /v1/auth/phone/verify` — at the moment the dealer asks for
a code, against the box in front of them — so the walk-back is exercised by
`PHONE_NOT_VERIFIED`, which is what the create answers for a number that was
typed rather than proved. The mechanism is the same and is what this story is
for; a refusal about a step 2 field deliberately does _not_ move, see
`BusinessNameTaken`.

### `export const Documents: Story =`

Step 3 — a DRAFT dealership exists. The frame's Back/Continue row is gone:
from here on the movement is by navigation, and the step brings its own
controls, Back included.

**Continue does not move while anything is outstanding.** It replaced a
"Skip for now" and a Continue that merely counted what was missing — both
let a dealer walk to the end of the wizard and only there be told what they
had skipped. What counts as outstanding is the server's `completeness`
answer, because that is the derivation `POST /v1/dealer/submit` refuses on.

The yard photograph sits with the documents because this is the step where a
dealer uploads things, but it is required for a different reason: it is the
hero of the public portfolio, and a dealership whose storefront would open
with an empty frame is not ready to be reviewed.

### `export const DocumentsComplete: Story =`

The same step once the registrations, the checklist and the photograph are done.

### `function dealership(status: 'DRAFT' | 'PENDING_APPROVAL')`

A dealership on the session, at whichever point of its life the story needs.

### `export const Review: Story =`

Step 4, before the submit. The dealership is still DRAFT, so the step is a
call to action: Back to Documents, or submit for verification.

Press Submit to watch the pending state — the stub takes ~1s.

### `export const ReviewSubmitted: Story =`

Step 4, after. `session.dealer.status` is `PENDING_APPROVAL`, and that single
fact replaces the whole form: no submit, no Back.

Both absences are deliberate. There is nothing left to submit, and a Back
button leading to a form whose answers are already committed would be a lie.
The state is read from the session rather than from local state, so a refresh
shows this panel rather than the button the dealer already pressed.

### `export const ReviewRefused: Story =`

A refused submit. Press Submit: the API answers 422 `PROFILE_INCOMPLETE`, and
the step lists the same blockers the step-2 banner does — the endpoint
decides with the derivation the wizard reads, so the two can only be wrong
together.

### `export const EveryStep: Story =`

All four at once, which is the only way to see that the stepper fills
cumulatively rather than marking a single position — `index <= current`,
C015.

## `apps/sandbox/src/stories/auth/phone-verification.stories.tsx`

### `const FAKE_WIDGET: PhoneOtpWidget =`

C040b — step 1's mobile check, in its four states (**R39**).

DESIGN-SPEC §3.10. The mobile number stopped being something a dealer types
and became something they prove: MSG91's OTP widget puts a code on the
handset, and the API refuses to build a dealership around a number that was
never confirmed.

── What this component decides, and what it does not ───────────────────────
Nothing about whether the code was right. The widget runs in the browser and
produces a signed token; the token means nothing until the API takes it to
MSG91 with a key no browser holds. So `verified` is a **prop** — the
session's answer — not something this component remembers, which is why
editing the number drops it out of the settled state for free and a reload
shows the truth.

── Four things to check by eye ─────────────────────────────────────────────

· **Send OTP.** The panel opens and names the number the code went to.
On the development driver it says which digits will be accepted; no
message is sent and no widget script is loaded.
· **Type into the boxes.** Focus moves forward on a digit and back on
Backspace, and a pasted six-digit code fills all six — which is what a
phone's "copy code" affordance actually produces.
· **Get it wrong.** The panel turns red, keeps the digits so they can be
read back, and counts down the attempts left. Three wrong codes and it
asks for a fresh one rather than spending the server's allowance.
· **Get it right.** The step's forward action becomes _Continue to
business details_ — the design puts it in the panel rather than in the
wizard's footer, so there is one state machine rather than two.

The Server Action is stubbed (coupling **C-4**): see
`src/mocks/phone-actions.ts`.

### `function Harness(`

The wizard's job, done by the story: hold the number and remember which one
the session has proved. Without it the settled panel could not be reached by
clicking, only by a prop.

### `phoneActionStub.availability = {}`

Free, unless the story about a taken number says otherwise.

### `export const SendCode: Story =`

State 1 — the number is typed and nothing has been sent.

### `export const NumberAlreadyRegistered: Story =`

The check that runs **before** a message is sent: the number belongs to
another dealership, so nothing is sent at all.

This refusal used to arrive with the verification — after the SMS had been
paid for and delivered to a handset whose owner had never asked for one.
Press **Send OTP** and watch it stop here.

### `export const CodeEntry: Story =`

State 2 — a code is out. Enter `123456` to settle it.

### `export const Refused: Story =`

State 3 — the API refused it. The digits stay so they can be read back
against the SMS, and the attempts left are named.

### `export const AttemptsSpent: Story =`

The same panel, with every attempt spent: the only way on is a new code.

### `export const Verified: Story =`

State 4 — settled, and carrying the step forward.

### `export const NotConfigured: Story =`

A deployment with no MSG91 credentials. The screen says so where the dealer
is about to need it, rather than offering a button that fails on click.

### `export const ServiceUnreachable: Story =`

The API itself could not be reached — same panel, our own words.

## `apps/sandbox/src/stories/auth/sign-out.stories.tsx`

### `const meta =`

Sign out — a form, not a link.

A GET that ends a session can be triggered by any `<img>` on any page, so
this posts. The two scopes below hit different API paths and revoke sessions
in different scopes; they look identical on purpose, because a person in both
consoles should not have to learn two controls.

The Server Action is stubbed here — coupling C-4, see `mocks/auth-actions.ts`.

### `export const BothScopes: Story =`

Both scopes together, which is the point: they are the same control.

### `export const CustomClassName: Story =`

The console header passes its own class rather than wrapping the button.

## `apps/sandbox/src/stories/auth/yard-photo-uploader.stories.tsx`

### `function photo(overrides: Partial<YardPhotoDto> = {}): YardPhotoDto`

DESIGN-SPEC §3.10 step 3 — the yard photograph (C041b).

The hero of the dealership's public portfolio, and the reason it is a
separate component rather than a fourth row of the KYC checklist: a document
row is a tick, this is the image a buyer sees first, and the dealer has to be
shown it at a size where they can tell whether it is any good.

**The instruction text is the component.** A dealer asked for "a photo" sends
a phone snap of a car; a dealer told what the image is _for_ — straight on,
daylight, the whole frontage, not a logo — sends the shot of the entrance
they already have. The cost of that sentence is one line. The cost of not
having it is a moderator rejecting the application and a day of round-trip,
which is why it is worth looking at rather than reading past.

The upload is presign → PUT straight to storage → commit, the same pipeline
the documents use, with one difference at the far end: the photograph it
replaces is discarded on **commit**, not on presign. A dealer who opens the
file picker and changes their mind still has the picture they had before.
There is no network in the sandbox, so pressing Upload opens a picker and
then fails at `fetch` — honest rather than useful, and the same limit the
document stories carry. The two refusals that _are_ reachable are the ones
checked before anything is signed: a file over 10 MB, or one that is not a
JPEG, PNG or WebP. Pick a PDF to see the second.

One thing worth knowing while reading the stories: the component keys off
`url`, not `mediaId`. The API signs a read whenever the media row exists —
unconditionally, not only for `READY` — so the two cannot disagree, and
there is no state where a photograph is on file but the frame reads empty.

### `export const Empty: Story = { args: { photo: photo() } }`

Nothing uploaded — where every dealership starts, and the state the
instruction text has to carry on its own. Note that there is no Delete
button: there is nothing to delete, and a disabled one would be furniture.

### `export const Uploaded: Story =`

Uploaded. The preview is served through a short-lived signed URL rather than
a public path, because the dealership is not approved yet and its portfolio
is not public until it is.

Replace and Delete both appear here. Replace is the same pipeline as a first
upload; the displaced image is removed from storage when the new one commits.

### `export const WidePhotograph: Story =`

A wide photograph in the same slot. Worth checking by eye: dealers send
whatever their phone produced, and the frame has to hold a panorama and a
near-square without either one deciding the height of the step.
