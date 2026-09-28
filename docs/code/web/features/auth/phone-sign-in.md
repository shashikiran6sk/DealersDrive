# web / features/auth/phone-sign-in

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/auth/phone-sign-in/phone-sign-in.tsx`

### `export function PhoneSignIn({`

**R63** — sign in with a mobile number: the number, Send OTP, then the same
code panel onboarding's `PhoneVerification` uses. It is shared by both tabs,
and deliberately knows nothing about customers or dealers — `onProved` is
handed the number and the widget's token and answers an error or `null`, and
the caller decides what a proved number means.

It is not `PhoneVerification` with a flag. That component verifies a number
typed into _another_ form, checks availability for a signed-in account, and
carries onboarding's Continue; this one owns its number field and signs
somebody in. What they genuinely share — sending through MSG91 and turning a
code into a token — is `lib/phone-otp.ts`, so there is still one OTP
implementation, not two.

### `if (!isIndianMobile(phone)) {`

The same predicate the API validates with (contracts), asked before anything
is sent, so a landline costs no SMS.
