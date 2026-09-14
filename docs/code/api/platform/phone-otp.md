# api / platform/phone-otp

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/phone-otp/factory.ts`

### `export function createPhoneOtp(): PhoneOtpPort`

The `PHONE_OTP_DRIVER` seam, resolved once in the container (**R39**).

`env.ts` refuses `msg91` without the auth key and the two widget values, and
refuses `fake` in production — so neither branch can be reached in a state it
cannot serve. The failure is a refused boot naming a variable rather than a
dealer discovering at the sign-up screen that no code ever arrives.

## `apps/api/src/platform/phone-otp/fake.adapter.ts`

### `export const DEV_OTP_PREFIX = 'dev-otp:'`

The no-SMS driver — `pnpm dev`, the test suite, and any preview environment
without an MSG91 account (**R39**).

It is a real implementation of the port rather than a stub: onboarding works
end to end on it, including the refusals. What it does not do is send
anything or reach the network.

**The token shape is explicit on purpose.** Under this driver the browser
never loads the widget script, so there is no provider to mint a token —
the page builds one itself, and it has to say _which_ number it is claiming
or the binding check in `phone.service.ts` would have nothing to compare
against. `dev-otp:919840012345:123456` is that shape, and it is unmistakable
in a log: nobody will confuse it for something MSG91 issued.

**Anything after the code is ignored**, which is what lets a caller make one
of these unique. The replay guard in `phone.service.ts` remembers a token for
fifteen minutes, so without a nonce a developer who verified the same number
twice in one sitting would be told their code had already been used — a
refusal about the fixture rather than about anything the product does.

It cannot be reached in production. `env.ts` refuses `PHONE_OTP_DRIVER=fake`
there, and the MSG91 adapter would hand this string to MSG91, which rejects
it — two independent reasons, which is the number a development bypass
should have.

### `if (code !== devCode) return { status: 'REJECTED', reason: 'wrong code' }`

The code is checked rather than ignored. A driver that accepted anything

### `if (code !== devCode) return { status: 'REJECTED', reason: 'wrong code' }`

would let a wrong-code test pass for the wrong reason, and the failure

### `if (code !== devCode) return { status: 'REJECTED', reason: 'wrong code' }`

path is the half of this feature most worth exercising locally.

## `apps/api/src/platform/phone-otp/msg91.adapter.ts`

### `const ENDPOINT = 'https://control.msg91.com/api/v5/widget/verifyAccessToken'`

MSG91's OTP widget, verified server-side (**R39**).

One authenticated `POST`, no SDK — the same reasoning as the Resend mailer
and as the baseline's MSG91 SMS adapter: a dependency to make a single JSON
request is a dependency to audit, update and explain.

    POST https://control.msg91.com/api/v5/widget/verifyAccessToken
    { "authkey": "…", "access-token": "<jwt from the widget>" }

**`authkey` never leaves this process.** It is the credential that can spend
the MSG91 balance, and the whole reason this call is server-to-server rather
than something the page could do for itself.

── Where the identifier comes from ─────────────────────────────────────────
The widget's server-side documentation publishes the request but not the
response body, and the shape reported in the wild varies: some accounts get
`{ type: 'success', message: '919840012345' }`, others a bare acknowledgement.
The product cannot act on "a token was valid" alone — it has to know _whose_
handset, or the binding check in `phone.service.ts` has nothing to compare —
so the identifier is looked for in two places, in this order:

1. the response body, when it carries something that reads as an
   identifier;
2. the access token's own payload.

Reading the JWT is safe **only in that order**, and the order is the whole
argument: the token's signature has already been checked, by MSG91, in the
call above. A forged token never reaches step 2 because step 1 rejected it,
and a genuine token's payload cannot be edited without invalidating the
signature that got it past step 1. This decodes a claim; it does not trust an
unverified one.

If neither yields an identifier the call is `REJECTED`, not accepted. Failing
open here would mean accepting any token that verifies for any number.

### `const IDENTIFIER_CLAIMS = ['identifier', 'mobile', 'number', 'phone', 'msisdn'] as const`

Claim names seen carrying the verified identifier, most specific first.

### `signal: AbortSignal.timeout(env.PHONE_OTP_TIMEOUT_MS)`

Bounded, because a dealer is watching a spinner. Four seconds is
the same budget the RC lookup takes for the same reason: the
fallback — try again — is one press away, so failing fast beats
succeeding slowly.

### `logger.warn({ err: error, driver: 'msg91' }, 'msg91 access-token verification unreachable')`

DNS, TLS, a dropped socket, the timeout above. Not the dealer's

### `logger.warn({ err: error, driver: 'msg91' }, 'msg91 access-token verification unreachable')`

fault and not a wrong code — see `PhoneOtpVerdict`.

### `logger.info`

The provider's own words are logged and not returned. A caller is
told "that code could not be verified" and nothing more: this
response distinguishes an expired token from an unknown widget from
a wrong account, and none of those are facts a browser should be
handed about somebody else's number.

### `logger.error`

Verified, but for nobody we can name. Accepting this would be

### `logger.error`

accepting any valid token for any number.

### `function isSuccess(body: unknown): boolean`

MSG91's envelope: `{ type: 'success' | 'error', message: … }`.

### `function text(value: unknown): string`

A field of the provider's answer as a string, or nothing.

Written out rather than `String(value)` because `message` is documented
nowhere and has been seen carrying an object — and `String({})` is
`'[object Object]'`, which would be logged as though it were the provider's
own sentence.

### `function identifierFromBody(body: unknown): MsisdnDigits | null`

The identifier in the response, when there is one.

`message` carries it on the accounts that return it, and carries a sentence
on the ones that do not — so it is accepted only when it _reads_ as an
identifier. `'Access token validated'` has no digits in it and falls through
to the token payload rather than being mistaken for a number.

### `function identifierFromToken(accessToken: string): MsisdnDigits | null`

The identifier inside the token MSG91 has just told us is genuine.

Decoded, not verified — see the note at the top of this file for why that is
sound here and would not be anywhere else.

### `function asIdentifier(value: unknown): MsisdnDigits | null`

A value that is an msisdn, or nothing.

Deliberately strict about what counts. An email identifier, a request id or
a sentence must not be mistaken for a phone number here — the caller
compares whatever comes back against the number the dealer claimed, and a
value that is not a number would simply fail that comparison, but it would
fail it for a confusing reason.

## `apps/api/src/platform/phone-otp/phone-otp.port.ts`

### `export type MsisdnDigits = string`

The seam between the product and whoever actually sent the SMS (**R39**).

There is exactly one question behind this port, and it is deliberately not
"was this code correct": **which identifier does this token prove?** The code
never reaches the API. MSG91's OTP widget runs in the dealer's browser,
sends the message, collects the six digits and answers with a signed access
token; the only thing the server can do with that token is take it to MSG91
and ask whose handset it belongs to.

Shaping the port that way is what keeps the trust boundary in one place. A
`verify(code)` signature would invite an adapter that believes the browser,
and the browser is the one participant here with a reason to lie.

Two adapters today, chosen by `PHONE_OTP_DRIVER`:

fake — no network, no SMS, no widget script. Accepts a token of the
documented development shape and answers with the identifier
inside it. Correct for `pnpm dev` and for the test suite;
`env.ts` refuses it in production.
msg91 — the real provider. `POST /api/v5/widget/verifyAccessToken`
with the server-only `MSG91_AUTH_KEY`.

### `export type MsisdnDigits = string`

An identifier as MSG91 states it: digits, country code included, no `+`.

### `export type PhoneOtpVerdict =`

Three outcomes, not two, and the third is why.

`REJECTED` means MSG91 answered and said no — an expired token, a replayed
one, a forgery. `UNAVAILABLE` means MSG91 did not answer at all. Collapsing
them would tell a dealer their code was wrong during a vendor outage, and
send them round the resend loop spending SMS against a provider that is down.

### `readonly driver: 'fake' | 'msg91'`

Names the active adapter. Reported to the browser, never branched on here.

### `identify(accessToken: string): Promise<PhoneOtpVerdict>`

Ask the provider which identifier this access token proves.

Never throws for a refusal — a refusal is a verdict. It throws only for a
bug, which is the error handler's business rather than this caller's.
