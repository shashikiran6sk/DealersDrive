# web / features/auth/phone-verification

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/auth/phone-verification/captcha.tsx`

### `export function Captcha({ id }: { id: string })`

Where MSG91 renders its captcha when it decides one is needed.

The element has to exist _before_ `initSendOTP` runs — `captchaRenderId` is
looked up by id — so it is rendered unconditionally rather than in response to
a challenge that has already been missed. `empty:hidden` keeps it out of the
layout until the widget puts something in it.

## `apps/web/src/features/auth/phone-verification/phone-code-panel.tsx`

### `export function PhoneCodePanel(`

A code is out: six boxes, a resend countdown, verify or cancel — and the same
panel in `err` once a code has been refused.

### `onKeyDown={(event) =>`

Enter inside these boxes submits the code, and — more to the point — must
not submit the wizard's form. Steps 1 and 2 share one `<form>` whose
submit creates the dealership, and implicit submission from a field on
step 1 would post a half-filled step 2.

## `apps/web/src/features/auth/phone-verification/phone-unavailable.tsx`

### `export function PhoneUnavailable({ reason }: { reason?: string })`

The provider could not be reached, or the deployment has it switched off.

## `apps/web/src/features/auth/phone-verification/phone-verification.constants.ts`

### `export const RESEND_SECONDS = 30`

How long before a new code may be asked for. The design's countdown runs from here.

### `export const LOCAL_ATTEMPTS = 3`

Wrong codes accepted before a fresh one is required. A **guard rail, not the
limit** — the real limits are the API's ten presentations in ten minutes and
MSG91's own per-number cap. Three wrong codes almost always means the dealer
is reading an older SMS.

## `apps/web/src/features/auth/phone-verification/phone-verification.tsx`

### `export function PhoneVerification(`

DESIGN-SPEC §3.10 — step 1's mobile check, in its four states (**R39**).

It runs MSG91's widget in the browser: `sendOtp` puts a code on the dealer's
handset and `verifyOtp` hands back a signed access token. It then posts that
token to the API and **believes the API's answer and nothing else**. A page
that could decide for itself that a number was verified is a page that can be
told to; the only thing that can settle the question is a call carrying
`MSG91_AUTH_KEY`, and that key is never in a browser.

So `verified` is a prop, not state — the wizard's reading of the _session_,
which means editing the box drops the panel out of its success state for free
and a reload shows the truth rather than what this component last remembered.

The four states: **idle** (Send OTP), **code** (six boxes and a countdown),
**failed** (the same panel in `err`, with the local attempts left) and
**verified** (Continue).

**The step's forward button lives here** because the design puts Send OTP,
Verify & continue and Continue to business details in three places across
three states of one step. A footer owned by the wizard would have to mirror
this component's stage, and two copies of one state machine is exactly the bug
that produces a dead Continue button.

### `const [resendAt, setResendAt] = useState(() =>`

When a new code may be asked for. Seeded when the panel _opens_ on a code
rather than arriving at one, which only the sandbox does: a story showing the
code panel without its countdown would be showing a state the product never
renders.

### `const busy = useRef(false)`

Guards the window between a click and the render that disables the button.
`pending` arrives a paint later, and a double-click inside that paint is two
SMS on a provider we cannot rate-limit from here.

### `async function send(form: HTMLFormElement | null, resend: boolean): Promise<void>`

Put a code on the handset.

Under the `fake` driver nothing is sent and no script is loaded — the panel
opens and says which digits it will accept. That is not a stub of this flow:
every refusal below, the server action, the API call and the binding check
underneath all run unchanged. Only the provider is replaced.

### `if (!resend)`

Three questions, in this order, and only the third costs anything.
`onBeforeSend` asked whether it is a number. This asks whether it is
_free_ — before the widget sends, because the widget sends from the
browser and the API cannot refuse a message already on its way. It used
to be answered by the verification, which meant a dealer who typed a
number another dealership holds paid for an SMS, read the code off their
own handset, and only then was told they could not have it.

Not repeated on a resend: the number has not changed since the check that
let the first code out.

### `if (onRefused) onRefused(available.error)`

One message, not two. This is a refusal about the value in the input,
so it belongs under the input — which is what `onRefused` is for. The
fallback is for a caller that owns no field to mark, i.e. the sandbox.

### `if (resend) await retryMsg91Otp(identifierOf(phone))`

MSG91 wants `919840012345` — country code included, no `+`.

### `setFailure(isServiceFailure(error) ? error.message : PHONE_TEXT.sendFailed)`

The reason, when there is one worth showing. A bare `catch {}` under one
fixed sentence is the wrong trade for a provider integration: "check it
and try again" is useless advice when the actual problem is that the
script is blocked or the domain is not allow-listed, and the person who
can fix that is the one reading this screen.

### `async function verify(entered: string): Promise<void>`

Hand the token to the API, which is the only party that can judge it.

### `:`

The documented development shape — see
`platform/phone-otp/fake.adapter.ts`. The trailing nonce is what the
server's replay guard needs: it remembers a token for fifteen
minutes, and without one a second attempt at the same number in one
sitting would be refused as a reuse rather than judged on the code.

### `refuse(isServiceFailure(error) ? error.message : PHONE_TEXT.wrongCode)`

The widget refused the code itself and never minted a token, so the API

### `refuse(isServiceFailure(error) ? error.message : PHONE_TEXT.wrongCode)`

was not reached. A wrong code is the overwhelmingly likely reason;

### `refuse(isServiceFailure(error) ? error.message : PHONE_TEXT.wrongCode)`

anything the widget reports is shown instead, because that is a problem

### `refuse(isServiceFailure(error) ? error.message : PHONE_TEXT.wrongCode)`

the dealer cannot solve by retyping.

### `if (!widget?.enabled) return <PhoneUnavailable reason={widget?.reason ?? undefined} />`

Narrows `widget` for the code panel below: enabled is only ever true with one.

### `if (stage === 'failed' && next.length < OTP_DIGITS) setStage('code')`

Typing over a rejected code returns the panel to its ordinary state;

### `if (stage === 'failed' && next.length < OTP_DIGITS) setStage('code')`

leaving it red while the dealer corrects it reads as if the new digits

### `if (stage === 'failed' && next.length < OTP_DIGITS) setStage('code')`

were wrong too.

## `apps/web/src/features/auth/phone-verification/phone-verification.types.ts`

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

The wizard's own check on the fields above — a name, a well-formed number —
run before a message is sent. Returning false stops the send: an SMS costs
money, and a dealer who has mistyped their number would be paying for it to
arrive somewhere else.

### `onRefused?: (message: string) => void`

A refusal about the number itself, reported so the step can mark the box.
"That mobile number is already registered to another dealership" is about
the value in the input, so it belongs under the input with `aria-invalid` on
it. The panel shows it too, because the panel is where the press happened.

### `initialStage?: PhoneStage`

Where the panel opens. `idle` in the product, always — this exists so the
sandbox can render the states that are otherwise only reachable by sending a
real message.

## `apps/web/src/features/auth/phone-verification/phone-verified.tsx`

### `export function PhoneVerified({ display, fullName, onContinue }: PhoneVerifiedProps)`

The number is settled, and the step's forward action is Continue.

## `apps/web/src/features/auth/phone-verification/utils.ts`

### `export function identifierOf(phone: string): string`

`9840012345` → `919840012345`, which is the identifier shape MSG91 uses.

### `export function isServiceFailure(error: unknown): error is Error`

A provider problem the dealer cannot solve by retyping, as opposed to a wrong code.
