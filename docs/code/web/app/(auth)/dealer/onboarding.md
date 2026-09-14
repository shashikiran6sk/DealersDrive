# web / app/(auth)/dealer/onboarding

Parent: [web](../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(auth)/dealer/onboarding/page.tsx`

### `export const dynamic = 'force-dynamic'`

DESIGN-SPEC §3.10 — dealer onboarding.

The screen a verified Google account lands on when it has no dealership yet,
and the screen a half-finished dealership returns to. Which of the four steps
it opens on is decided here, on the server, from the session — not from
anything the browser remembers.

The email is never asked for. It arrived from Google, the API verified it,
and step 1 shows it as a read-only verified field.

### `const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false }`

── Reconstruction slice ────────────────────────────────────────────────────
The baseline spreads `seoMetadata({ kind: 'private' })` from `lib/seo.ts`
here. That file is the whole indexing policy in one function and belongs to
**F095**; what it resolves to for a `private` route is the literal below.
The same substitution was made at `(auth)/dealer/login/page.tsx` in F018,
for the same reason — an onboarding screen carrying a person's name, phone
and business details must be `noindex` from the day it exists.

### `if (session.dealer && !['DRAFT', 'PENDING_APPROVAL'].includes(session.dealer.status))`

A dealership that is DRAFT is still being set up, and one awaiting approval

### `if (session.dealer && !['DRAFT', 'PENDING_APPROVAL'].includes(session.dealer.status))`

still has a screen here — the "under review" panel that closes the wizard

### `if (session.dealer && !['DRAFT', 'PENDING_APPROVAL'].includes(session.dealer.status))`

(DESIGN-SPEC §3.10 step 4). Anything else belongs in the console.

### `const [documents, dealer, completeness, yardPhoto, phoneWidget] = await Promise.all([`

All dealership-scoped, so they exist only once one does.

### `const [documents, dealer, completeness, yardPhoto, phoneWidget] = await Promise.all([`

`GET /v1/cities` was the fifth request here, fetched for a dropdown on

### `const [documents, dealer, completeness, yardPhoto, phoneWidget] = await Promise.all([`

step 2. The city is typed now, so the screen no longer waits on reference

### `const [documents, dealer, completeness, yardPhoto, phoneWidget] = await Promise.all([`

data to render a form the dealer fills in themselves.

### `phoneWidgetOrNull()`

The MSG91 widget's credentials (**R39**), read on the server and handed
down as a prop.

They have to reach the browser — the widget cannot initialise without
them — but not as `NEXT_PUBLIC_*`, which is inlined at build time and
would make rotating a widget a rebuild of this image (rule 9). Fetched
here rather than by the client component so the panel has them on its
first paint, and `null` on failure rather than a thrown page: a dealer
should be told mobile verification is unavailable, not shown an error
screen instead of their sign-up form.

### `const floor = session.dealer?.status === 'PENDING_APPROVAL' ? 3 : 0`

Where the wizard opens, and how far back it goes.

The floor used to be 2 once a dealership existed, on the reasoning that
steps 1 and 2 _create_ it and so are behind you. That is true of the write
and false of the dealer: a name typed wrong on step 2 could not be
corrected without an admin, and step 3 had a Back button pointing at a step
the server would bounce them off. Steps 1 and 2 now amend as readily as
they create, so the only floor left is the real one — a submitted
dealership has nothing to edit while it is being reviewed.

Where it _opens_ when no step is asked for is a separate question, and
`landingStep` below answers it.

### `function stepOf(value: number): OnboardingStep`

Which step a dealer arriving with no `?step=` lands on.

Three cases, and the third is the one that needed a rule.

· **No dealership yet** — step 1. There is nothing else it could be.
· **Waiting for a decision** — step 4, the "we are reviewing this" panel.
There is nothing to edit while somebody is looking at it.
· **A draft.** Ordinarily step 3: a returning dealer wants the step they
had reached, not the one they finished last week.

An application a moderator **sent back** is a draft too, and landing it on
step 3 would be wrong — the dealer arrives to be told something needs
changing and is put on the screen after the one that usually holds it.
`statusReason` on a DRAFT dealership is the mark of that: nothing else sets
it, so it means "an admin looked at this and handed it back".

Where it lands then depends on _what_ was asked for, and the completeness
answer already knows. A rejected document leaves the Documents step
incomplete — the file was deleted with the rejection — so that is where the
work is. A request for changes to the business details leaves every step
complete, and the only screen that can be meant is the first one, where the
name, address and contact live.

Deriving it from `completeness` rather than storing a step on the dealership
keeps one answer to "what is outstanding": the same one `POST
/v1/dealer/submit` refuses on.

### `function stepOf(value: number): OnboardingStep`

The clamp above yields a number the compiler cannot follow back to the four
steps. Anything that is not one of them — a fractional `?step=`, which the
product never links to — opens at the first, which is where an unreadable
request should land.

### `async function phoneWidgetOrNull(): Promise<PhoneOtpWidget | null>`

`GET /v1/auth/phone/widget`, or null (**R39**).

A verification service that cannot be reached is a state this screen renders
— see `PhoneVerification`'s `enabled` branch — rather than a reason to fail
the whole page. The one thing it must never do is silently let onboarding
proceed without a code: it does not, because the API refuses the create with
`PHONE_NOT_VERIFIED` regardless of what this answered.

### `async function session_(): Promise<AuthSession>`

The session, or the sign-in screen. A 401 here is a redirect, not an error page.
