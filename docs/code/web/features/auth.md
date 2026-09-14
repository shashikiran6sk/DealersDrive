# web / features/auth

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/auth/actions.ts`

### `export interface ActionState`

The writes that change who you are.

They are Server Actions rather than browser fetches, for one reason:
the session cookie has to be set and cleared server-side (ARCHITECTURE
§15.2). No token is ever handed to client JavaScript — there is nothing in
`localStorage`, nothing in a React state atom, and nothing a script on the
page could read.

### `values?: Record<string, string>`

What was submitted, so a rejected form re-renders with it rather than blank.

### `const ONBOARDING_FIELDS = [`

There is no `adminLoginAction` here any more.

Admin sign-in is a browser navigation to the API's `/v1/auth/admin/google/
start`, exactly as the dealer's is — no form, no credential crossing this
process, and no session for a Server Action to relay. The cookie is set by
the API on the callback.

### `const ONBOARDING_FIELDS = [`

The fields steps 1 and 2 carry between them, in one list.

They are echoed back on a rejection so a bad pincode does not cost the dealer
the other eight answers, and the list is written once because a field missing
from it fails silently — the form re-renders blank in exactly one box, which
is the kind of bug nobody reports.

### `export async function onboardingAction`

Dealer onboarding — the step between a verified Google identity and a tenant.

### `export async function updateOnboardingAction`

Steps 1 and 2 again, for a dealership that already exists.

`Back` from the documents step has to lead somewhere, and once a tenant has
been created the create path cannot be walked a second time — it would refuse
with `DEALER_ALREADY_EXISTS`. So the same two steps PATCH instead, which is
what `PATCH /v1/dealer` is partial for.

`phone` is deliberately not sent. It is the login identity, and changing it
needs an OTP round-trip on the new number that onboarding does not have.

### `await apiSend('PATCH', '/v1/dealer/onboarding', parsed.data)`

`/v1/dealer/onboarding`, not `/v1/dealer` (**R27**). The profile screen's
route now takes three fields — the year, the tagline and the services —
and this step is asking for the name, the address and the contact
details. A DRAFT dealership is one still answering those questions, or
one sent back to fix an answer, and that is exactly what the onboarding
route is guarded to.

### `export async function signOutAction(scope: 'dealer' | 'admin' = 'dealer'): Promise<void>`

Sign out, for either console.

The API call is what matters: it revokes the `sessions` row, so the token
stops working everywhere rather than merely being forgotten by this browser.
Clearing the cookie afterwards is housekeeping, and is deliberately done even
if the revoke failed — a browser holding a cookie it believes in is worse
than one that has to sign in again.

### `(await cookies()).delete(SESSION_COOKIE)`

Already expired, already revoked, API down — all end the same way.

### `export async function saveBusinessIdsAction`

C2, from onboarding step 3 — the two registrations the KYC review needs
alongside the uploaded documents (DESIGN-SPEC §3.10).

A separate write from the dealership itself because it happens after the
tenant exists, and because a dealer can come back to it: `PATCH /v1/dealer`
is partial, so filling one field never blanks the other.

### `await apiSend('PATCH', '/v1/dealer/onboarding', parsed.data)`

The onboarding route (**R27**) — GSTIN and PAN are verified against a

### `await apiSend('PATCH', '/v1/dealer/onboarding', parsed.data)`

document, so they are not on the profile screen's schema either.

### `export async function submitForVerificationAction(): Promise<ActionState>`

C4 — the last step of onboarding: hand the dealership to a moderator.

The dealer does not become ACTIVE here. This submits an _event_; the state
machine and an admin decide the rest (Rule 5), which is why the success path
lands on a "we're reviewing this" panel rather than on the dashboard.

### `function text(formData: FormData, key: string): string`

A form field as text. `FormData.get` can return a `File`, and `String(file)`
is `[object File]` — a value that would validate as a string and then be
saved as one. Anything that is not text reads as absent.

### `const FORM_FIELD: Record<string, string> = { line: 'addressLine' }`

A validation path, as the name of the input it belongs to.

The wizard's fields are flat — `city`, `addressLine`, `pincode` — and both
validators answer in paths: Zod with `['address', 'city']`, the API with
`body.address.city`. Neither matches an input, so before this an error
against anything nested rendered against no field at all: the dealer saw a
banner saying something was wrong and not one box highlighted. Taking the
leaf fixes every case but one, and `line` is that one.

### `const leaf = (parts.at(-1) ?? path).match(/^\d+$/)`

A numeric leaf is an array index, and there is no input named `0`.
`specialities` is the first array this form carries (**R26**), and Zod
answers a too-long entry with `['specialities', 2]` — so the index is
stepped over and the error lands on the box the dealer typed it into.

### `function apiFieldErrors(error: ApiError): Record<string, string>`

The same, for the field errors the API answers a 400 or a 409 with.

## `apps/web/src/features/auth/document-uploader.tsx`

### `const TONE: Record<DealerDocumentDto['status'], StatusTone> =`

DESIGN-SPEC §3.10 step 3 — one KYC document row.

presign → PUT straight to storage → commit, the same three-step contract the
vehicle photos use (ARCHITECTURE §12.1). The file never passes through the
Next server: only the signing and commit calls are proxied, because those
need the session.

KYC documents are private. There is no public delivery route for them at all
— an admin reads one through a short-lived signed URL, and every issue of one
is audit-logged (§26.6).

**Replace and Remove are two verbs, not one.** Replace is presign → PUT →
commit and the API deletes the displaced object as part of it. Remove is the
dealer deciding a document should not be there at all — the wrong scan, the
wrong dealership's PAN card — and the row goes back to `REQUIRED` with the
bytes gone. Without the second, the only way to correct a mistake is to
upload something else over the top of it, which is not the same thing.

### `const TAG: Record<DealerDocumentDto['status'], string> =`

A tag is a state, not a sentence. The API's `statusLabel` is written for the
row's sub-line ("Required — PDF or JPG, max 5 MB"); repeating it inside the
tag says the same thing twice and pushes the row over its width.

### `const uploaded = document.status !== 'REQUIRED'`

Anything but `REQUIRED` means bytes exist, and bytes can be taken back.

### `{uploaded ?`

Only when there is something to delete. A `Delete` next to an empty row
is a control that cannot do anything, and a disabled one is worse — it
implies the row is in a state the dealer could get out of.

## `apps/web/src/features/auth/onboarding-wizard.tsx`

### `export const ONBOARDING_STEPS = ['Account', 'Business', 'Documents', 'Review'] as const`

DESIGN-SPEC §3.10 — Account → Business → Documents → Review.

The split is not cosmetic. Steps 1 and 2 are one form: nothing is written
until "Continue" on the Business step, so a dealer who abandons halfway
leaves no half-made tenant behind. Steps 3 and 4 act on a dealership that
exists, and are reached by a real navigation so the server can re-read it.

Which step you may be on is decided on the server from the session. This
component moves between them; it does not decide what you are allowed to see.

**Two rules run through every step here.**

_Nothing advances on an empty required field._ Steps 2 and 4 were always
gated — one by Zod on the submit, one by `canSubmit` — while steps 1 and 3
were not, so a dealer could walk to the end of the wizard and only then be
told what they had skipped. Step 1 now validates in the browser before it
moves, and step 3 is gated on the server's own `completeness` answer, which
is the same condition `POST /v1/dealer/submit` enforces. Two derivations of
"is this ready" would eventually disagree, and the disagreement would be
about whether somebody is allowed to trade.

_Every step but the first goes back._ That costs steps 1 and 2 a second
write path — once a dealership exists the create call refuses with
`DEALER_ALREADY_EXISTS` — so `edit` below picks `PATCH /v1/dealer` instead.
The fields, the layout and the validation are the same either way; only the
verb changes.

**A refusal is shown on the step that can act on it.** Both uniqueness
checks — the phone number and the registered name — are answered by the
write, which happens when step 2 submits. But the phone number is typed on
_step 1_, so a 409 against it used to land the dealer on the Business step
with a banner about a field they could not see, and no way to tell which box
was wrong. `ACCOUNT_FIELDS` below is what the wizard walks back for: when the
API names one of them, the form returns to step 1 and the message renders
against the input it belongs to.

**Where the duplicate check lands.** A dealership's name has to be unique
within its city, and both halves of that pair are typed on step 2 — so the
question can only be asked when this step submits. It is asked in the
database, by the write itself, rather than by a lookup as the dealer types:
a check answered before the submit is a check two applications can race past
between the answer and the write, and it would also hand anyone with a
browser a way to enumerate which dealerships exist where. A collision comes
back as a 409 that names `legalName`, so the step stays put with the message
against the field.

### `phoneWidget: PhoneOtpWidget | null`

`GET /v1/auth/phone/widget` (**R39**), or null when it could not be read.

### `const [local, setLocal] = useState<0 | 1>(step === 1 ? 1 : 0)`

Steps 1 and 2 move in the browser; steps 3 and 4 move by navigation.

The asymmetry follows the write. Account and Business submit together, so
stepping between them must not touch the server — there is nothing to
re-read, and a round trip would cost the dealer everything they had typed.
Documents and Review each act on a dealership that already exists, so they
are reached by a URL the server resolves afresh.

### `const [navigated, setNavigated] = useState(step)`

A navigation between steps 1 and 2 has to move the local pair with it.

`local` is initialised once, and Next keeps this component mounted across a
`?step=` change — same route, same position in the tree — so `Back` from
the Documents step pushed `?step=1` and arrived showing whatever half of
the pair happened to be open, which was Account, because that is what it
was initialised to when the page was entered at step 3. Reconciled during
render rather than in an effect, so the step and the pane change in one
paint instead of the wrong pane being committed first.

### `const edit = dealer !== null`

The same two steps, one verb apart: create the dealership, or amend the one

### `const edit = dealer !== null`

that is already there because the dealer pressed Back to get here.

### `const [accountErrors, setAccountErrors] = useState<Record<string, string>>({})`

What step 1 refuses to move past, checked here rather than on submit.

The server validates these too — it is the only thing that counts — but on
step 1 that verdict would not arrive until the dealer had filled in step 2
and pressed Continue, which is three fields and a city later than the
mistake. This is the message arriving where it can still be acted on.

### `const values = state.values ?? {}`

What the dealer typed, echoed back by the action. A rejected pincode must

### `const values = state.values ?? {}`

not cost them the other eight fields.

### `const [answered, setAnswered] = useState(state)`

A refusal that names a step 1 field walks the wizard back to step 1.

The commonest one by far is `PHONE_ALREADY_REGISTERED`: the number belongs
to another dealership, the API says so against `body.phone`, and `phone` is
three fields up on a step that is currently hidden. Without this the dealer
reads "that mobile number is already registered" while looking at the city
and pincode boxes.

Adjusted _during_ render, on the render that first sees a new `state`,
rather than in an effect. `useActionState` delivers the answer as a render,
and React re-runs this component immediately on a set made this way — so
the message and the step change land in one paint. An effect would commit
the error against a hidden fieldset first and move on the next frame, and
that gap is real: it is exactly what the test on a slow machine sees.

`answered` is what makes it fire once per submission instead of on every
render: `state` is a fresh object each time the action resolves.

### `const [fullName, setFullName] = useState`

Step 1's two answers, held here rather than in the DOM (**R39**).

Everything else on this form is uncontrolled — `defaultValue`, read back
out of `form.elements` — and that was right while the fields were only
ever read on submit. The mobile number stopped being one of those: the
verification panel below renders it, sends a message to it and compares
what came back against it, all between keystrokes. A value three
components need to agree about, live, is state.

`fullName` comes with it because the success panel names the person the
number was linked to, and a name read once on mount would be the one they
had typed before they corrected it.

### `const [verifiedPhone, setVerifiedPhone] = useState<string | null>(() =>`

The number this account has proved, as ten digits — or null.

Seeded from the session, which is the only authority on it, and moved only
by `POST /v1/auth/phone/verify` answering yes. Comparing it to what is in
the box is what makes editing the number drop the panel out of its
verified state: there is one fact here and one place it is read from,
rather than a "verified" flag that could outlive the value it was about.

### `return session.user.phoneVerified && digits.length === 10 ? digits : null`

The length check is not belt-and-braces: a session with no number at all

### `return session.user.phoneVerified && digits.length === 10 ? digits : null`

reduces to `''`, and `'' === ''` would make an empty box read as verified.

### `const sentBack = dealer?.status === 'DRAFT' ? dealer.statusReason : null`

The note an admin sent this application back with.

`statusReason` is only set on a DRAFT dealership by one thing — a moderator
pressing _Request changes_, or rejecting one document — so its presence is
what distinguishes an application that was looked at and handed back from
one that was never finished. It is shown on every step rather than only the
first, because the thing that needs fixing may be three steps along and a
banner that scrolls away with the step is a banner the dealer reads once.

### `<p className="my-[2px] whitespace-pre-line border-l-[3px] border-current/40 py-[2px] pl-[10px] text-[14px] font-semibold`

The moderator's own words, set apart from the sentence under them.

They were a bare `<p>` sitting directly above the reassurance that
nothing was lost, in the same size and weight — two paragraphs of
equal-looking text, of which only the first is actually actionable.
This is the one line in the banner that a person wrote about _this_
dealership, and it is the only thing on the screen that says what to
fix, so it is the line that has to survive being skimmed.

A rule down the left and a heavier weight, rather than a second
colour: the banner is already `warn`, and the accent is drawn from
`currentColor` so it stays legible in whatever the tone resolves to
instead of pinning an amber that a future `err` variant would
inherit wrongly. `whitespace-pre-line` because a moderator listing
two problems types them on two lines and the box should show them
that way.

### `{Object.keys(state.errors ?? {}).length === 0 &&`

The API refuses an incomplete dealership; this says which part.

Only when nothing more specific came back, though. A refusal that
names a field — a registered name already taken in this city, most
of all — is already marked against the box it belongs to, and
following it with a list of unrelated outstanding items reads as if
those were the problem.

### `<div hidden={local === 1}>`

Step 1's forward action is inside the panel, not in the footer.

It is three different buttons across three states — Send OTP,
Verify & continue, Continue to business details — and a footer that
tried to draw the right one would be a second copy of the panel's
state machine. The footer below is therefore step 2's alone.

The panel stays mounted while step 2 is showing, `hidden`, for the
reason the fieldsets do: unmounting it on a local move would throw
away a countdown and a half-typed code every time the dealer
pressed Back.

### `setAccountErrors((found) => ({ ...found, phone: message }))`

Against the box, not only in the panel — it is a refusal

### `setAccountErrors((found) => ({ ...found, phone: message }))`

about the number the dealer typed.

### `<div className="flex gap-[8px]" hidden={local === 0}>`

Step 2's footer, and only step 2's — which is why the whole row is
hidden on step 1 rather than each button being conditional.

Step 1 is the first step, and the first step has nothing behind it:
the baseline sent `Back` here to `/dealer/login`, which is not a
step of this wizard — it signs the dealer out of the flow they are
halfway through. Its forward action is in the verification panel
above, because a number that has not been proved is not a step
anyone may leave.

### `<button type="submit" className="btn btn-primary h-[42px] flex-1" disabled={pending}>`

One button now, and it is always the submit.

It used to be two — a local move on Account, a submit on Business
— reconciled as one DOM node and needing distinct `key`s to stop
a single press doing both. R39 removed the pair rather than the
symptom: the Account step's forward action moved into the
verification panel above, because a number that has not been
proved is not a step anyone may leave.

### `const ACCOUNT_FIELDS = new Set(['fullName', 'phone'])`

The fields that live on step 1.

One list, used for both halves of the same rule: what the browser validates
before it will move off the Account step, and what the wizard walks _back_ to
that step for when the API refuses one of them. Two lists would drift, and
the drift would be a dealer stuck on step 2 with an invisible error.

### `function validateAccount(form: HTMLFormElement | null): Record<string, string>`

The required fields of step 1, read straight off the form.

Off the DOM rather than out of React state, because these inputs are
uncontrolled — they carry `defaultValue` so that re-rendering the step never
discards what is half-typed in it. The form element is the state.

### `if (!isIndianMobile(value('phone')))`

The same predicate the API validates with, imported rather than copied —

### `if (!isIndianMobile(value('phone')))`

the copy that used to live here disagreed with the placeholder beside it

### `if (!isIndianMobile(value('phone')))`

about whether `98400 12345` is a phone number.

### `function localDigits(value: string | null | undefined): string`

Ten digits, whatever shape the number arrived in.

`users.phone` is E.164 (`+919840012345`), `dealers.contactPhone` mirrors it,
and the box asks for the ten digits under the `+91` prefix beside it. One
reduction, used for the box's value _and_ for the comparison that decides
whether the number in it is the verified one — two would eventually disagree,
and the disagreement would be a dealer re-verifying a number they had
already proved.

### `phoneVerified: boolean`

Whether the number in the box is the one this account proved (**R39**).

### `<div className="mb-[16px] flex items-center gap-[10px] border border-(--color-divider) bg-(--color-accent-100) px-[13px]`

The verified identity, shown rather than asked for. Google has already
proved this address belongs to whoever is at the keyboard, and an
editable email field here would be a way to claim one it never verified
— the API would reject it, but the form should not offer it.

### `readOnly={phoneVerified}`

Settled once it has been proved.

A verified number is a fact about a handset somebody answered,
and typing over it would quietly throw that away — which is what
used to happen, including on the way back from step 2, where the
box looked exactly as editable as it had before the code was
sent.

`readOnly` rather than `disabled`, and the difference is
load-bearing: a disabled input is **not submitted**, so the
number would vanish from the FormData that creates the
dealership. Read-only keeps it in the form, out of the tab order
for editing, and announced as read-only.

### `<Field`

One name, not two.

The baseline asked for a public brand name and a registered legal name
side by side, and dealers filled both in with the same words — twice
the typing for a distinction that never held. The registered name is
the one KYC is checked against, so it is the one asked for, and it is
what buyers see.

### `<Field id="city" label="City" error={errors.city}>`

City and state, typed.

Both were a dropdown and a disabled box beside it, filled in from a
five-row table: choose one of five towns, and the state is whatever
the table says. A dealer in Salem could not finish this form, and
one in Bengaluru could not be described by it. Two text fields
instead — the server normalises case and spacing so one town does
not become three, and the duplicate-name check below is what the
city is really load-bearing for.

### `<Field id="district" label="District" error={errors.district}>`

The district, beside the city rather than instead of it.

It is the unit support and moderation actually work in — "every
dealer in Vellore district" is a question the admin console can now
answer, and "every dealer whose town is spelt Vellore" is not the
same question. Free text like its two neighbours, and normalised by
the same server-side function, so one district cannot arrive as
three filter values.

### `<Field`

Where the yard is, rather than what its address resolves to.

A typed address is not a location — "18, Gandhi Road" is four
different pins in one district, and the buyer who follows the wrong
one has already driven there. The dealer knows which pin is their
gate, and this is the shortest way for them to say so. It spans both
columns because a share link is longer than a pincode, and the
instruction under it is there because "paste a Maps link" is obvious
only to somebody who has done it before.

### `type="text"`

`text`, not `url`: Share → Embed copies an `<iframe …>`, which

### `type="text"`

the server accepts and unwraps (R13), and which native URL

### `type="text"`

validation would refuse before the form is ever submitted.

### `<Field`

The one line the public pages run under the dealership's name.

Asked for here because this is the one moment a dealer is already
describing their business — a separate profile screen later is a
screen most of them never open, and a portfolio whose only prose is
a generated line about a town reads like a directory entry.

It replaces a four-row `About your dealership` textarea (**R26**).
That box wanted two or three sentences and got either a paragraph
nobody read or twenty characters of "we sell used cars": prose is
the thing a person filling in a sign-up form at the end of a
working day is least able to produce, and a line is a question they
can actually answer. Nothing public renders the paragraph any more
(R25), so asking for it would be collecting writing to store.

Required, like every other field on this step, with a floor of ten
characters — a required box with no minimum is satisfied by `-`.

### `<Field`

What the yard actually does, as a set of short labels.

The only structured thing on the public pages a buyer can compare
two dealerships by: the directory card shows the first three, the
portfolio shows all of them. A platform where most rows are empty is
a platform where that comparison does not exist, so this is asked
for here rather than left to the profile screen.

Comma separated rather than a chip editor, which is what the profile
screen already does — one input, one parse, and the same wording on
both screens. Repeats are merged on read (R18), so a dealer typing
"RC transfer" twice is not refused for a typo.

### `const outstanding = stepOutstanding(completeness, 'documents').concat`

What this step is still missing, in the server's own words.

Derived from `completeness` rather than counted here, because the same
answer is what `POST /v1/dealer/submit` refuses on. Counting `REQUIRED`
rows in the browser would be a second derivation of the same question, and
the two would eventually disagree about whether a dealership is ready.

### `<form action={submit} className="flex flex-col gap-[14px]" noValidate>`

GSTIN and PAN in mono, as the review screen renders them (§3.10).

### `{outstanding.length > 0 ?`

No "Skip for now".

It was there because nothing downstream depended on this step being
finished — and nothing did, right up until the review step refused to
submit and listed everything that had been skipped. Saying so here, next
to the fields it names, is the same information three screens earlier.

### `{outstandingLabels(completeness).length > 0 ?`

The API refuses an incomplete dealership; this says which part.

### `const MISSING_LABELS: Record<string, string> =`

What C3 says is still missing, in words a dealer can act on. The API answers
with field keys — `gstin`, `GST_CERTIFICATE` — which are precise and not
something to put in front of somebody at the end of a sign-up form.

### `function stepOutstanding(completeness: CompletenessResponse | null, key: string): string[]`

The same, for one named step.

## `apps/web/src/features/auth/phone-actions.ts`

### `export interface PhoneVerificationState`

The server half of the phone check (**R39**).

A Server Action rather than a browser `fetch`, for the reason every write in
this app is one: the `dd_session` cookie is HttpOnly and is forwarded by
`lib/api.ts` on the server. No token is handed to client JavaScript, and the
API's base URL never has to become a `NEXT_PUBLIC_*` variable (rule 9,
ARCHITECTURE §15.3).

The access token does cross this boundary, in the other direction — the
widget minted it in the browser and it has to reach the API somehow. That is
safe precisely because it proves nothing on its own: only MSG91, asked with
the server-only auth key, can say what it is worth.

### `error?: string`

The one line the panel shows when it did not work.

### `revalidatePath('/dealer/onboarding')`

The onboarding page reads `phoneVerified` off `GET /v1/auth/me` to decide
what step 1 shows. Without this, a dealer who verifies and then reloads —
or who presses Back from step 3 — is asked for a code they have already
given, because the cached render still says the number was never proved.

### `export async function checkPhoneAvailabilityAction(phone: string): Promise<{ error?: string }>`

Is this number free, asked **before** a message is sent (**R39**).

The order step 1 works in is: is it a number, is it free, then send. Only the
third costs anything, and the second used to be answered by the verification
— so a dealer who typed a number another dealership holds paid for an SMS,
read the code off their own handset, and only then found out.

`204` is free. Anything else is the API's own sentence, which is rendered
against the phone box rather than as a banner: the refusal is about the value
in front of them.

## `apps/web/src/features/auth/phone-verification.tsx`

### `export type PhoneStage = 'idle' | 'code' | 'failed'`

DESIGN-SPEC §3.10 — step 1's mobile check, in its four states (**R39**).

── What this component decides, and what it does not ───────────────────────
It runs MSG91's widget in the browser: `sendOtp` puts a code on the dealer's
handset and `verifyOtp` hands back a signed access token. It then posts that
token to the API and **believes the API's answer and nothing else**. A page
that could decide for itself that a number was verified is a page that can be
told to; the only thing that can settle the question is a call carrying
`MSG91_AUTH_KEY`, and that key is never in a browser.

So `verified` is a prop, not state. It is the wizard's reading of the
_session_ — "is the number currently in the box the one this account
proved?" — which means editing the box drops the panel out of its success
state for free, with no reconciliation to get wrong, and a reload shows the
truth rather than what this component last remembered.

── The four states ─────────────────────────────────────────────────────────
idle the number is being typed; the step's forward action is Send OTP
code a code is out; six boxes, a resend countdown, verify or cancel
failed the same panel in `err`, with what is left of the local attempts
verified the number is settled, and the forward action is Continue

The failure state's attempt count is a **guard rail, not the limit**. The
real limits are the API's — ten presentations in ten minutes — and MSG91's
own per-number sending cap. Three wrong codes almost always means the dealer
is reading an older SMS, so this stops and asks for a fresh one rather than
letting them spend the server's allowance proving it.

── Why the step's forward button lives here ────────────────────────────────
The design puts Send OTP, Verify & continue and Continue to business details
in three places across three states of one step. A footer owned by the wizard
would have to mirror this component's stage to know which to draw, and two
copies of one state machine is exactly the bug that produces a dead Continue
button. Step 1's action bar is therefore part of this panel, and the wizard
draws its own only from step 2 on.

### `const RESEND_SECONDS = 30`

How long before a new code may be asked for. The design's countdown runs from here.

### `const LOCAL_ATTEMPTS = 3`

Wrong codes accepted before a fresh one is required. See the note above.

### `widget: PhoneOtpWidget | null`

`GET /v1/auth/phone/widget`, or null when the API could not be reached.

### `phone: string`

The ten digits currently in the phone box. Owned by the wizard.

### `fullName: string`

Shown on the success panel — "…has been linked to R. Manikandan".

### `verified: boolean`

The session's answer: is `phone` the number this account proved?

### `onVerified: (phone: string) => void`

Called once the API has recorded the number, with it in E.164.

### `onContinue: () => void`

The step's forward move, from the success panel.

### `onBeforeSend: (form: HTMLFormElement | null) => boolean`

The wizard's own check on the fields above — a name, a well-formed number
— run before a message is sent. Returning false stops the send: an SMS
costs money, and a dealer who has mistyped their number would be paying for
it to arrive somewhere else.

### `onRefused?: (message: string) => void`

A refusal about the number itself, reported so the step can mark the box.

"That mobile number is already registered to another dealership" is about
the value in the input, not about this panel — so it belongs under the
input, with `aria-invalid` on it, like every other field refusal in this
form. The panel shows it too, because the panel is where the press
happened.

### `initialStage?: PhoneStage`

Where the panel opens. `idle` in the product, always — this exists so the
sandbox can render the states that are otherwise only reachable by sending
a real message.

### `const [resendAt, setResendAt] = useState(() =>`

When a new code may be asked for.

Seeded when the panel _opens_ on a code rather than arriving at one, which
only the sandbox does: a story showing the code panel without its countdown
would be showing a state the product never renders.

### `const busy = useRef(false)`

Guards the window between a click and the render that disables the button.

`pending` arrives a paint later, and a double-click inside that paint is
two SMS on a provider we cannot rate-limit from here.

### `async function send(form: HTMLFormElement | null, resend: boolean): Promise<void>`

Put a code on the handset.

Under the `fake` driver nothing is sent and no script is loaded — the panel
opens and says which digits it will accept. That is not a stub of this
flow: every refusal below, the server action, the API call and the binding
check underneath all run unchanged. Only the provider is replaced.

### `if (!resend)`

Three questions, in this order, and only the third costs anything.

`onBeforeSend` above asked whether it is a number. This asks whether it
is _free_ — before the widget sends, because the widget sends from the
browser and the API cannot refuse a message already on its way. It used
to be answered by the verification, which meant a dealer who typed a
number another dealership holds paid for an SMS, read the code off
their own handset, and only then was told they could not have it.

Not repeated on a resend: the number has not changed since the check
that let the first code out.

### `if (onRefused) onRefused(available.error)`

One message, not two.

This is a refusal about the value in the input, so it belongs under
the input — which is what `onRefused` puts it there for. Setting
`failure` as well printed the same sentence twice, once under the
box and once in this panel, three lines apart. The fallback is for
a caller that owns no field to mark, which is the sandbox.

### `if (resend) await retryMsg91Otp(identifierOf(phone))`

MSG91 wants `919840012345` — country code included, no `+`.

### `setFailure`

The reason, when there is one worth showing.

This used to be a bare `catch {}` under one fixed sentence, which is
the wrong trade for a provider integration: "check it and try again"
is useless advice when the actual problem is that the script is
blocked or the domain is not allow-listed, and the person who can fix
that is the one reading this screen. The full error object goes to the
console either way — see `lib/msg91-widget.ts`.

### `async function verify(entered: string): Promise<void>`

Hand the token to the API, which is the only party that can judge it.

### `:`

The documented development shape — see
`platform/phone-otp/fake.adapter.ts`. It names the number because
there is no provider here to name it, and the server still checks
the two against each other rather than taking the claim on trust.

### `dev-otp:${identifierOf(phone)}:${entered}:${String(Date.now())}`

The trailing nonce is what the server's replay guard needs: it
remembers a token for fifteen minutes, and without one a second
attempt at the same number in one sitting would be refused as a
reuse rather than judged on the code.

### `refuse`

The widget refused the code itself and never minted a token, so the API

### `refuse`

was not reached. A wrong code is the overwhelmingly likely reason and

### `refuse`

reads as one; anything the widget itself reports is shown instead,

### `refuse`

because that is a problem the dealer cannot solve by retyping.

### `if (!enabled)`

── unavailable ──────────────────────────────────────────────────────────

### `if (verified)`

── verified ─────────────────────────────────────────────────────────────

### `if (stage === 'idle')`

── idle ─────────────────────────────────────────────────────────────────

### `const failed = stage === 'failed'`

── code · failed ────────────────────────────────────────────────────────

### `onKeyDown={(event) =>`

Enter inside these boxes submits the code, and — more to the point —
must not submit the wizard's form. Steps 1 and 2 share one `<form>`
whose submit creates the dealership, and implicit submission from a
field on step 1 would post a half-filled step 2.

### `if (failed && next.length < 6) setStage('code')`

Typing over a rejected code returns the panel to its ordinary

### `if (failed && next.length < 6) setStage('code')`

state; leaving it red while the dealer corrects it reads as if

### `if (failed && next.length < 6) setStage('code')`

the new digits were wrong too.

### `function identifierOf(phone: string): string`

`9840012345` → `919840012345`, which is the identifier shape MSG91 uses.

### `function Captcha({ id }: { id: string })`

Where MSG91 renders its captcha when it decides one is needed.

The element has to exist _before_ `initSendOTP` runs — `captchaRenderId` is
looked up by id — so it is rendered unconditionally rather than in response
to a challenge that has already been missed. `empty:hidden` keeps it out of
the layout until the widget puts something in it.

## `apps/web/src/features/auth/sign-out.tsx`

### `export function SignOutButton(`

Sign out — a form, not a link.

A GET that ends a session can be triggered by any image tag on any page, so
this posts. The Server Action revokes the row at the API before clearing the
cookie, which is the difference between signing out and merely forgetting.

## `apps/web/src/features/auth/yard-photo-uploader.tsx`

### `export function YardPhotoUploader({ photo }: { photo: YardPhotoDto })`

The yard photograph — the hero of the dealership's public portfolio.

Same presign → PUT → commit pipeline as the KYC documents beside it, and a
deliberately different presentation. A document row is a checklist tick; this
is the image a buyer will see first, so the dealer is shown it at a size where
they can tell whether it is any good.

The instruction text is doing real work and is not filler. A dealer asked for
"a photo" sends a phone snap of a car; a dealer told what the image is _for_
sends the shot of the entrance they already have. The cost of the second
sentence is one line; the cost of not having it is a moderator rejecting the
application and a day of round-trip.

### `{/* eslint-disable-next-line @next/next/no-img-element */}`

A plain <img>, not next/image. The source is a short-lived signed
URL against object storage — it changes on every render and the
optimiser has nothing stable to cache, so routing it through
/_next/image would cost a round trip per view and buy nothing.
