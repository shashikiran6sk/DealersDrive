# Admin mobile OTP — implementation checkpoint

Status: implementation completed; [PR #293](https://github.com/shashikiran6sk/DealersDrive/pull/293)
is open and unmerged. The sections below record historical implementation checkpoints.
Current final-SHA certification is maintained in the PR description and
[published evidence](https://github.com/shashikiran6sk/DealersDrive/tree/testing_evidence/docs/testing/implementation-campaign/pr-06-admin-otp).
Branch: `feat/admin-mobile-otp`; parent `feat/optional-dealer-tagline`.
Parent certified head: `465a5cd129de8b03be02cd551ca9e4bf238a39c6` (PR #292).

## Original audit findings

- Google admin authentication exists and must remain the identity authority.
- All three session scopes previously shared `dd_session`. Admin OAuth and person OAuth
  also share `dd_oauth`; concurrent starts can overwrite a pending transaction.
- Session records store scope/time but not authentication method. Enrollment therefore
  needs explicit Google assurance on a recent admin session, not just a recent OTP login.
- `PhoneProofService` reuses MSG91's widget verification, binds the verified identifier,
  and consumes a global token hash in the cache. Its admin purposes must fail closed.
- `User.phone` is globally unique and supports person login. Admin phone credentials
  should be a separate unique credential bound to the existing admin user, so a phone
  also used by a customer does not silently merge users or transfer ownership.
- API CORS is configured, but there is no explicit origin/CSRF middleware. New credential
  enrollment and login need trusted-origin checks and browser-bound challenge material.
- Admin admission uses active User/AdminMember and bootstrap allow-list rules. Admin role
  seat suspension must also be checked at login and each authorized request.

## Required design

1. Separate HttpOnly admin session and admin OAuth transaction cookies. Preserve dealer/
   customer cookie behavior and scope-specific logout. Update web cookie forwarding by
   route scope. Match callbacks to the signed transaction state without clearing the other
   audience's cookie. Retain Google PKCE/nonce/state and account-linking behavior.
2. Record authentication method; require a recent GOOGLE admin session for enrollment.
   Legacy sessions require fresh Google authentication. No password authentication.
3. Persist purpose-bound, expiring, limited-attempt OTP challenges bound to phone, member,
   browser nonce and enrollment session. Enforce cooldown/rate limits, single use, and
   concurrent redemption. Reuse the existing provider; never log raw proofs/OTPs.
4. Link a unique verified admin phone credential to the existing authorized user. Never
   create an admin from a number or mutate the person's customer/dealer phone identity.
5. OTP login resolves only that credential and rechecks active account/member/role before
   rotating an ADMIN session. Customer/dealer numbers alone confer no admin access.
6. Replacement needs fresh Google step-up and controlled prior-credential/recovery checks.
   Revocation and recovery must invalidate relevant OTP credentials/sessions and audit.
7. Add Google/mobile login options and Admin Profile → Security enrollment/revocation UI.
   Keep provider failures secure and error text non-enumerating.

## Verification gates

Complete all required validation before PR creation. Review provider expiry
semantics against official MSG91 documentation; do not infer verification from a frontend
callback. Execute the dedicated 35-case security matrix, real database concurrency tests,
Google/dealer/customer regressions, mobile browser UAT, and final-SHA required CI. Do not
start PR 7 until PR 6's complete post-creation campaign and CI pass.

No production migration, message delivery, deployment, merge, or protection change is
allowed. Synthetic local fixtures and controlled provider adapters only.

## Completed foundation checkpoint

Admin session and OAuth cookies are now separate, with signed-state callback selection
that preserves another audience's pending transaction. Web admin/Sales requests forward
the admin cookie; admin logout leaves person cookies and their auth hint intact. Admin
admission also rejects a suspended ADMIN role seat. Sessions have nullable method
assurance; new Google admin sessions record GOOGLE and historical methods remain unknown.

Executed: workspace typecheck PASS; 65 actual integration cases across auth/admin-members/parallel session isolation
PASS with clean isolated migration. This is an implementation checkpoint, not full PR 6
certification. OTP credentials/challenges, enrollment/login/recovery UI, full isolation and
security regression matrix, screenshots, post-creation tests and GitHub CI remain pending.

## OTP implementation checkpoint

Separate credentials, persistent challenges and proof hashes, fail-closed limiting, trusted
Origin checks, recent Google enrollment, atomic OTP session rotation, revocation and Google
recovery are implemented. Login and Profile → Security reuse the existing OTP controls.
Suspended admin seats cannot be reactivated by Google step-up. Legacy migration rehearsals
and backend/web/contract/provider cases are added. The current final pre-creation test run,
production build, actual browser campaign, post-creation testing and final-SHA CI must finish
before this branch is certified or PR 7 starts. See
[the security design and rollout notes](admin-mobile-otp.md) for precise policy and provider
limitations. Live Google/SMS and production configuration are not claimed as tested.

## Coverage hardening follow-up

PR 7's first full validation passed every test but measured 89.97% API branch coverage, below
the unchanged 90% gate. PR 7's UI work was preserved while this originating branch gained
additional security scenarios: logout or revocation during provider verification, expiring
Google assurance, console permission removal, duplicate phone ownership through the actual API,
normalization, resend invalidation, provider configuration and mandatory proof freshness.
Product code and security gates are unchanged. The updated parent must pass full validation and
final-head CI before the child is advanced and its preserved UI work restored.
