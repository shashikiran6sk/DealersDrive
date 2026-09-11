# MSG91 phone verification

Google remains the login provider. MSG91 SendOTP proves contact-phone ownership.
The browser calls our API, so real SMS can be tested from localhost.

## Local development

Apply migrations: `pnpm --filter @dealers-drive/api db:migrate`.
When switching from the Firebase branch, change your ignored `.env` to:

```dotenv
PHONE_VERIFICATION_DRIVER=fake
PHONE_VERIFICATION_FAKE_CODE=123456
```

Press Send code and enter `123456`. No SMS is sent; challenge ownership, expiry,
limits and database writes still run. For real SMS, configure standard MSG91
SendOTP, complete its DLT sender/template setup, then use:

```dotenv
PHONE_VERIFICATION_DRIVER=msg91
MSG91_AUTH_KEY=your-server-auth-key
MSG91_OTP_TEMPLATE_ID=your-approved-sendotp-template
MSG91_OTP_TIMEOUT_MS=4000
PHONE_SEND_USER_LIMIT=5
PHONE_SEND_IP_LIMIT=20
PHONE_SEND_DAILY_LIMIT=500
```

Restart the API. `SMS_DRIVER` controls notification SMS separately. `FIREBASE_*`
values are unused and may stay in the local env file for branch switching.
Provider keys never go into browser configuration. The production environment
refuses the fake driver and missing MSG91 credentials.

## Rollout and verification

Deploy migration `20260911140000_phone_verification_challenges` before the API.
Release API and web together: onboarding now requires a verified phone, established
using `{ challengeId, code }`. This is an independent alternative to the Firebase
PR, not a follow-on change to it. Terraform injects `MSG91_AUTH_KEY` through SSM
SecureString.

With a configured account, sign in through Google and send one code to a number
you control. Verify it, confirm the persisted phone and timestamp, and continue
onboarding. Check wrong-code, cooldown and expiry behavior. Measure delivery and
resend rates across target carriers before launch. Mocked tests do not establish
live delivery or account/DLT readiness.

The Verify endpoint requires the OTP in its query string. Transport errors are
discarded so URLs, codes and secrets cannot appear in logs. Only an explicit
`OTP verified success` response counts as proof, never an `already verified`
response. The application stores no OTP. Resend is an explicit new SendOTP call
after cooldown and rotates the local challenge. A provider timeout may still
deliver an SMS; the API does not retry automatically.

MSG91's standard OTP state is phone-scoped. Keep this SendOTP account isolated
from unrelated verification flows, which could replace a pending code.

## References

- [Managed OTP API](https://docs.msg91.com/otp)
- [SendOTP setup and DLT](https://msg91.com/help/sendotp/step-by-step-process-to-configure-otp)
- [Standard OTP pricing](https://msg91.com/in/pricing/otp)

This integration uses standard SendOTP, not the separately billed OTP Widget.
