# Admin mobile authentication

PR 6, based on the certified optional-tagline branch. Google remains the initial identity
authority and a recovery method. There is no password login and no phone-based admin creation.

## Credential enrollment and recovery

An admitted console administrator opens **Profile → Security** after Google sign-in. A Google
admin session created within ten minutes is required to start and redeem enrollment. Historical
sessions with unknown authentication method, and sessions created by mobile OTP, require another
Google round trip. Enrollment rechecks account, member, role seat and session inside the final
transaction. An active mobile credential cannot be overwritten by enrollment.

To replace or recover a lost number, use recent Google authentication to explicitly revoke the
credential. This increments its version, invalidates pending challenges, revokes every ADMIN
session and records an audit event atomically. Sign in again with Google, then verify the new
number. Mobile-only sessions cannot enroll or revoke credentials. If Google itself is unavailable
or compromised, existing privileged member-management procedures must disable access; this
feature provides no unauthenticated recovery shortcut. Revoked numbers remain reserved until
their owner completes replacement; there is no automatic reassignment to another administrator.

## Authentication protocol and isolation

- `dd_admin_session` and `dd_admin_oauth` isolate administrator sessions and pending Google
  transactions from person cookies. Signed callback state selects the correct transaction.
- Person sessions remain `dd_session`. Scope-specific logout cannot revoke a session from
  another scope even when a token is deliberately placed in the wrong cookie.
- Cookies remain HttpOnly, SameSite=Lax, Secure in production, with existing configured domain
  and path. Server-side forwarding selects the cookie by API route scope. Admin actions never
  set the customer auth hint. Tokens never enter client storage or successful JSON responses.
- Each challenge expires after five minutes and is bound to its purpose, canonical number,
  random 256-bit browser nonce, and enrollment session or credential version. Five API proof
  attempts are persisted independently of frontend controls. New challenges invalidate old ones.
- A database advisory lock serializes per-number requests. Cooldown is 60 seconds; at most five
  challenges per number in ten minutes. The shared CachePort additionally limits IP requests to
  40 per ten minutes and fails closed. These controls remain active if generic rate limiting is
  disabled. Production already requires the PostgreSQL cache adapter.
- Mutations require configured trusted Origin and JSON; cross-site Fetch Metadata is rejected.
  Next server actions supply the configured web Origin and retain Next's own Origin validation.
  The challenge nonce supplies browser binding for login as well as authenticated enrollment.
- Server-side MSG91 verification must name the requested number. Admin proofs also require
  `iat` and `exp`, with issuance no earlier than challenge creation minus five seconds and an
  unexpired expiry. Dates are decoded only after MSG91 accepts the token. Missing, invalid,
  future or stale claims fail closed. Existing dealer/customer proofs do not inherit this new
  admin-specific requirement.
- The existing global replay cache prevents reuse across purposes. Durable SHA-256 proof hashes
  also prevent successful admin redemption after cache loss. Challenge consumption, credential
  mutation or admin session issuance, rotation and success audit are one transaction. Concurrent
  callbacks cannot both issue sessions from one challenge.
- Admin admission and issuance share the existing member-management advisory lock with member
  disabling. Google also issues its session in the admission transaction. A disable racing a
  login either prevents issuance or revokes the session before it can remain usable.
- An active User, admitted ACTIVE AdminMember and unsuspended ADMIN seat with console permission
  are rechecked at redemption and every authorized request. Google step-up also respects seat
  suspension instead of reactivating it through legacy seat synchronization.
- `AdminPhoneCredential` has unique user and number constraints. It does not change `User.phone`.
  A customer and administrator may legitimately share a number while retaining separate users
  and privileges. Customer/dealer-only numbers never create administrator access.
- Unknown or unauthorized numbers receive the same challenge shape and generic verification
  refusal. No phone lookup, full number, provider proof or private identity is returned.

## Provider contract and rollout gate

[MSG91's widget flow](https://docs.msg91.com/otp-widget) returns a JWT after OTP verification and
requires server-side access-token verification. Its [configuration guide](https://msg91.com/help/sendotp/how-to-integrate-the-new-login-with-otp-widget)
describes provider-side resend and expiry settings. It does not establish that every tenant's
JWT contains usable `iat`/`exp` claims. This implementation deliberately refuses admin access
without them. Before eventual production rollout, verify that the configured tenant returns
these claims and enforce OTP attempt/resend limits in the provider dashboard. The client widget
can contact MSG91 directly; application challenge limits are not a claim of exclusive control
over provider delivery. Provider limits and CAPTCHA must remain enabled. No live message delivery
or real Google account testing is claimed by controlled local provider tests.

MSG91 timeout, HTTP 429/5xx or replay-cache outage yields unavailable and no session. Other
provider refusals remain generic. The server auth key is never sent to the browser. Logger
redaction covers `accessToken` and `browserToken`; provider refusal bodies are no longer logged.
Audit events store actor/entity IDs and credential version, without raw phone or proof values.

## Database and deployment notes

`20261010100000_admin_session_assurance` adds nullable method assurance without guessing the
method of old sessions. `20261010101000_admin_phone_credentials` adds private credential,
challenge and redemption tables with canonical-number, purpose, attempt, version, binding and
expiry constraints and supporting number/time indexes. Both migrations are transactional and
additive. Existing person phone data and session scope are preserved; no numbers are enrolled
automatically. No production data inventory or production migration was executed.

Coordinate API and web rollout: old web builds forward the person cookie to admin APIs, so
administrators must sign in again after the cookie change. Do not add a legacy shared-cookie
fallback. Apply schema before the new API; historical sessions require Google step-up. Retain
the previous application release and use a reviewed forward fix if needed; do not delete
credential or audit records to roll back. Challenge and proof-hash retention should be handled
by the platform's reviewed data-retention procedure, preserving replay guarantees.

## Verification and review

Executable real-cookie/database cases are in `apps/api/tests/admin-phone.test.ts` and
`admin-session-isolation.test.ts`; historical migration rehearsals are in
`admin-phone-migration.test.ts`. Controlled provider tests cover successful verification,
rejection, freshness and outages. Web tests cover challenge-before-send, backend refusal,
enrollment, server-action cookie relay and scope-specific forwarding. Existing Google, dealer,
customer, ownership, listing, support and account-linking suites are included in the full gate.

The campaign evidence report records actual executed outcomes and screenshots. The historical
556-case document is not a claim that all those cases have currently passed. Native Safari,
physical devices, real SMS delivery and production tenant configuration require owner UAT.

A timestamp-dependent sale-notification assertion exposed by this regression campaign now
compares delivery identities before and after the action, preserving the no-new-email invariant
without assuming two operations cannot share the same millisecond.

Owner UAT: sign in with Google; link a synthetic approved test number in Profile → Security;
sign out and use Mobile OTP; refresh and open another tab; verify a parallel customer session
survives admin logout; confirm a mobile session requires Google step-up to change credentials;
revoke, then recover through Google and enroll another number. Verify disabled members and
customer/dealer-only numbers cannot sign in. Use approved test accounts and keep proof codes,
contact details and provider credentials out of screenshots.

DO NOT MERGE. No production deployment is authorized.
