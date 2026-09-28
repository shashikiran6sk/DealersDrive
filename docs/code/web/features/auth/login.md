# web / features/auth/login

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/auth/login/login-tabs.tsx`

### `export function LoginTabs({ initial, customer, dealer }: LoginTabsProps)`

**R63** — the Customer / Dealer switch, on the `.seg` control DESIGN-SPEC §2.4
already names for tabs, with tab semantics rather than radio ones: a
`tablist` of two `tab`s, each owning a `tabpanel`.

Both panels stay mounted and the inactive one is `hidden`. A person who typed
half a number on one tab and glanced at the other comes back to what they
typed; unmounting would throw it away.

### `function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void`

Arrow keys move the selection and the focus together, wrapping at the ends,
and Home / End jump — the roving-tabindex pattern, so Tab leaves the control
rather than walking every option.

## `apps/web/src/features/auth/login/customer-login.tsx`

### `export function CustomerLogin({ widget, returnTo }: CustomerLoginProps)`

**R63** — prove the number, then either go back where the customer started
(an existing account) or ask for a name (a new one). Nothing else is asked:
no email, no password, no Google (R62).

### `const [attempt, setAttempt] = useState(0)`

Starting again after an expired sign-up ticket remounts the phone form rather
than resetting it field by field, so no half-state from the previous proof —
a code, a count of attempts — survives into the next.

## `apps/web/src/features/auth/login/customer-name-step.tsx`

### `export function CustomerNameStep({ phoneDisplay, onCreated, onRestart }: CustomerNameStepProps)`

The one question (R62), after the number is verified — and the screen says so,
with the number, so the customer knows the code worked and what the dealer
will see. The ticket that proves the number is not here: it is an HttpOnly
cookie the Server Action reads.

## `apps/web/src/features/auth/login/dealer-login.tsx`

### `export function DealerLogin({ widget, google, returnTo, error }: DealerLoginProps)`

**R63** — Google or the phone. Where the dealer lands is the API's answer
(R60's shared resolver), not this component's: onboarding for a draft or a
brand-new phone-first account (R61), the review screen while pending, the
console otherwise.

### `{DEALER_LOGIN_ERRORS[error] ?? DEALER_LOGIN_FALLBACK_ERROR}`

The Google callback's refusals arrive as `?error=` codes. They are looked up,
never echoed, so the query string cannot put words on this page.

## `apps/web/src/features/auth/login/login.constants.ts`

### `export const DEALER_LOGIN_ERRORS: Readonly<Record<string, string>> =`

Moved here from the old dealer sign-in page, unchanged, when that page became
a redirect.
