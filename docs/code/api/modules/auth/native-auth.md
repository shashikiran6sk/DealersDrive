# Native customer authentication

F100 introduces a transport adapter around the existing customer identity/session/signup services. It does not create another User store, refresh-token system, policy registry or authentication provider. Every credential is an existing random opaque CUSTOMER session, SHA-256 hashed in PostgreSQL, with the existing 30-day expiry and revocation controls. New sessions are returned in no-store JSON without browser cookies. Signup tickets and account/phone collision rules are unchanged.

## Capability gate and provider setup

NATIVE_CUSTOMER_AUTH_ENABLED defaults false, including all environment examples. Nothing enables production native auth by merging source. The owner must verify the existing MSG91 widget's standard server APIs, SMS channel, DLT template, account/token restrictions and CAPTCHA compatibility in a nonproduction environment before approving activation. The native app never initializes the MSG91 mobile SDK, receives its credentials or contacts MSG91 directly. Existing browser/dealer/admin provider configuration remains untouched.

Provider contracts were inspected in MSG91's published SDK 3.1.0 and current public web widget code. The standard web send URL is /api/v5/widget/sendOtp; resend/verify use retryOtp/verifyOtp. SMS resend uses the vendor channel code 11. Native mobile SDK sendOtpMobile and its Mobile Integration toggle are intentionally not used: enabling that toggle changes web compatibility. Send/retry success message contains the request ID; resend can replace it. Verify success carries an access-token or JWT message. HTTP success with an error payload is rejected. Unexpected/missing payloads and upstream/network/rate failures never imply successful authentication. Existing verifyAccessToken then independently validates the token and matching phone through CustomerAuthService.

Official references: [widget API flow and limitations](https://docs.msg91.com/otp-widget), [provider integration settings](https://msg91.com/help/sendotp/how-to-integrate-the-new-login-with-otp-widget), [published provider package](https://www.npmjs.com/package/@msg91comm/sendotp-react-native). Provider mocks validate inspected payload contracts; they are not live OTP/DLT evidence. No third-party settings, messages, secrets or cloud resources were changed during implementation.

## NativeOtpChallenge

Challenges are HMAC sealed with a distinct NATIVE_CUSTOMER_OTP_V1 purpose using the existing server session secret. Signed payload binds normalized Indian phone, provider request ID, unpredictable nonce and issue time. It expires after ten minutes; malformed, altered, expired and future challenges are rejected. Resend replaces the signed provider request ID while retaining nonce/expiry/attempt budget. The signed payload is a credential containing a phone number, not encryption: carry it only in HTTPS bodies, keep it in memory on device, and never log or put it in URLs.

Existing CachePort atomic counters provide cross-process IP/number/cooldown/spend limits, verification attempts and successful challenge consumption. No new cache/schema/migration or in-process replay Map. Every cache failure refuses native work even if the website's general rate limiter is disabled/fails open. Phone/IP counter keys are hashed; token/phone/challenge/signup-ticket log redaction is explicit.

Current limits: one send/number/minute, five/number/hour, twenty/IP/ten minutes, one thousand sends/day globally, three resend attempts and five verification attempts per challenge. Check actual remaining Retry-After on rate failures. Failed/ambiguous provider sends also consume spend budgets; never assume a timeout means no SMS was sent. These are bounded default spend controls requiring owner operational review before activation.

The challenge is consumed before the existing identity continuation opens a session or name ticket. Atomic consumption prevents concurrent verification from opening duplicate sessions/continuations. If a success response is lost or downstream provider/identity continuation fails after consumption, the client must explicitly begin a fresh OTP challenge; it must not silently replay verification. Resend/request are also non-idempotent and are not automatically retried. Invalid OTP before successful verification may be retried within its remaining attempt budget.

## Customer-only bearer boundary

Only the customer resolver parses Authorization; privileged cookie resolvers/readSessionToken remain unchanged. Header presence chooses one identity source: malformed/expired/revoked/disallowed bearer never falls back to an unrelated cookie. Bearer must resolve a CUSTOMER-scoped session and an active, named, phone-verified User with no suspended customer seat. Dealer/admin scopes are rejected even for the same User.

The explicit allowlist covers customer me/native me/logout, customer legal status/history/terms, enquiries, saved vehicles and customer support. Workspace/invitation routes share the old customer guard but are excluded because they expose dealer capabilities. No bearer access to dealer, admin or sales routes. Existing cookie customer/dealer-seat resolution remains compatible. Existing resource services enforce ownership; native credentials do not bypass enquiry consent, support quotas or saved-record isolation.

Private me/logout capability checks do not require updated policy acceptance/publication. Authentication/signup and protected business operations retain their distinct existing policy rules. Do not trap a signed-in customer out of account/support controls when policies change.

## Publication and platform-neutral contracts

The public legal adapter uses existing immutable documents, digests, registry approval and database publication/approval/effective metadata, including the independent sharing notice. Production with unapproved or inconsistent metadata returns UNAVAILABLE and no policy text/notice. Nonproduction drafts are explicitly DRAFT; collectionEnabled remains the existing enforcement switch. The native client echoes displayed versions; evidence/hash construction stays server-side. No draft is published and no legal gate is changed.

Customer DTOs and AgreementAcceptance were moved unchanged into lean modules and re-exported under existing names. The native-auth subpath imports pure schemas and contains no legal document archives, Next, Prisma, Node secrets or privileged screen code. The OpenAPI catalogue now includes Zod unions so the discriminated native login response is generated from the same contract. Customer-only bearer alternatives are generated for the allowlist; privileged/workspace/invitation schemes remain cookie-only. New endpoints are covered by route/document parity tests.
