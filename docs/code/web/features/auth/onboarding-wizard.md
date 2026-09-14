# web / features/auth/onboarding-wizard

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/auth/onboarding-wizard/account-step.tsx`

### `phoneVerified: boolean`

Whether the number in the box is the one this account proved (**R39**).

### `<div className="mb-[16px] flex items-center gap-[10px] border border-(--color-divider) bg-(--color-accent-100) px-[13px]`

The verified identity, shown rather than asked for. Google has already
proved this address belongs to whoever is at the keyboard, and an
editable email field would be a way to claim one it never verified.

### `readOnly={phoneVerified}`

Settled once it has been proved: a verified number is a fact about
a handset somebody answered, and typing over it would throw that
away — which is what used to happen on the way back from step 2.

`readOnly` rather than `disabled`, and the difference is
load-bearing: a disabled input is **not submitted**, so the number
would vanish from the FormData that creates the dealership.

## `apps/web/src/features/auth/onboarding-wizard/business-step.tsx`

### `<Field`

One name, not two. The baseline asked for a public brand name and a
registered legal name side by side, and dealers filled both in with the
same words — twice the typing for a distinction that never held. The
registered name is the one KYC is checked against, so it is the one
asked for, and it is what buyers see.

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

The one line the public pages run under the dealership's name, asked
for at the one moment a dealer is already describing their business —
a separate profile screen later is one most of them never open.

It replaces a four-row `About your dealership` textarea (**R26**),
which got either a paragraph nobody read or twenty characters of "we
sell used cars": prose is what a person filling in a sign-up form at
the end of a working day is least able to produce. Nothing public
renders the paragraph any more (R25).

### `<Field`

What the yard actually does, as a set of short labels — the only
structured thing on the public pages a buyer can compare two
dealerships by. A platform where most rows are empty is one where
that comparison does not exist, so it is asked for here rather than
left to the profile screen. Repeats are merged on read (R18).

## `apps/web/src/features/auth/onboarding-wizard/documents-step.tsx`

### `const outstanding = stepOutstanding(completeness, 'documents').concat`

What this step is still missing, in the server's own words.

Derived from `completeness` rather than counted here, because the same
answer is what `POST /v1/dealer/submit` refuses on. Counting `REQUIRED`
rows in the browser would be a second derivation of the same question, and
the two would eventually disagree about whether a dealership is ready.

### `<form action={submit} className="flex flex-col gap-[14px]" noValidate>`

GSTIN and PAN in mono, as the review screen renders them (§3.10).

### `{outstanding.length > 0 ?`

No "Skip for now". It was there because nothing downstream depended on
this step being finished — and nothing did, right up until the review step
refused to submit and listed everything that had been skipped. Saying so
here, next to the fields it names, is that information three screens
earlier.

## `apps/web/src/features/auth/onboarding-wizard/onboarding-wizard.constants.ts`

### `export const ACCOUNT_FIELDS = new Set(['fullName', 'phone'])`

The fields that live on step 1.

One list, used for both halves of the same rule: what the browser validates
before it will move off the Account step, and what the wizard walks _back_ to
that step for when the API refuses one of them. Two lists would drift, and the
drift would be a dealer stuck on step 2 with an invisible error.

### `export const TAGLINE_MIN = 10`

A required box with no minimum is satisfied by `-`.

### `export const MISSING_LABELS: Record<string, string> =`

What C3 says is still missing, in words a dealer can act on. The API answers
with field keys — `gstin`, `GST_CERTIFICATE` — which are precise and not
something to put in front of somebody at the end of a sign-up form.

## `apps/web/src/features/auth/onboarding-wizard/onboarding-wizard.tsx`

### `phoneWidget: PhoneOtpWidget | null`

`GET /v1/auth/phone/widget` (**R39**), or null when it could not be read.

### `export function OnboardingWizard(`

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

### `const [local, setLocal] = useState<LocalStep>(step === 1 ? 1 : 0)`

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

The moderator's own words, set apart from the sentence under them:
this is the one line a person wrote about _this_ dealership and the
only thing on the screen that says what to fix, so it has to survive
being skimmed. A rule and a heavier weight rather than a second
colour — the accent is `currentColor`, so it stays legible in whatever
the tone resolves to. `whitespace-pre-line` because a moderator
listing two problems types them on two lines.

### `{Object.keys(state.errors ?? {}).length === 0 &&`

The API refuses an incomplete dealership; this says which part.

Only when nothing more specific came back, though. A refusal that
names a field — a registered name already taken in this city, most
of all — is already marked against the box it belongs to, and
following it with a list of unrelated outstanding items reads as if
those were the problem.

### `<div hidden={local === 1}>`

Step 1's forward action is inside the panel, not in the footer: it is
three different buttons across three states, and a footer that tried
to draw the right one would be a second copy of the panel's state
machine. It stays mounted while step 2 is showing, `hidden`, for the
reason the fieldsets do — unmounting it on a local move would throw
away a countdown and a half-typed code.

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

One button now, and it is always the submit. It used to be two — a
local move on Account, a submit on Business — reconciled as one DOM
node and needing distinct `key`s to stop a single press doing both.
R39 removed the pair rather than the symptom.

## `apps/web/src/features/auth/onboarding-wizard/onboarding-wizard.types.ts`

### `export type LocalStep = 0 | 1`

Which half of the Account/Business pair is showing.

## `apps/web/src/features/auth/onboarding-wizard/review-step.tsx`

### `{outstandingLabels(completeness).length > 0 ?`

The API refuses an incomplete dealership; this says which part.

## `apps/web/src/features/auth/onboarding-wizard/utils.ts`

### `export function validateAccount(form: HTMLFormElement | null): Record<string, string>`

The required fields of step 1, read straight off the form.

Off the DOM rather than out of React state, because these inputs are
uncontrolled — they carry `defaultValue` so that re-rendering the step never
discards what is half-typed in it. The form element is the state.

### `if (!isIndianMobile(value('phone'))) errors.phone = ONBOARDING_TEXT.missingPhone`

The same predicate the API validates with, imported rather than copied — the

### `if (!isIndianMobile(value('phone'))) errors.phone = ONBOARDING_TEXT.missingPhone`

copy that used to live here disagreed with the placeholder beside it about

### `if (!isIndianMobile(value('phone'))) errors.phone = ONBOARDING_TEXT.missingPhone`

whether `98400 12345` is a phone number.

### `export function localDigits(value: string | null | undefined): string`

Ten digits, whatever shape the number arrived in.

`users.phone` is E.164 (`+919840012345`), `dealers.contactPhone` mirrors it,
and the box asks for the ten digits under the `+91` prefix beside it. One
reduction, used for the box's value _and_ for the comparison that decides
whether the number in it is the verified one — two would eventually disagree,
and the disagreement would be a dealer re-verifying a number they had proved.

### `export function stepOutstanding(completeness: CompletenessResponse | null, key: string): string[]`

The same, for one named step.
