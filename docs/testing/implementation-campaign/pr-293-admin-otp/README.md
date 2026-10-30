# #293 — admin Google + mobile OTP · independent review

PR: [#293](https://github.com/shashikiran6sk/DealersDrive/pull/293) · branch
`feat/admin-mobile-otp` · base `main`. Original author evidence:
[`../pr-06-admin-otp`](../pr-06-admin-otp); the branch's checkpoint log is kept
here as `original-implementation-checkpoints.md`.

| SHA                  | Value                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `main` at review     | `f2f4d7b` (#292 squash)                                                                                |
| Original PR head     | `e481bb0` (parent in stack `465a5cd`)                                                                  |
| Reconciled           | `b38dde9` — merge commit, tree = main + increment (only line offsets differ, from #290 in `logger.ts`) |
| Final validated head | `e9e8939`                                                                                              |

## Owner-reported defect — Link Mobile Number fails

**Symptom.** Admin → Profile → Security → Link Mobile Number: "That code did not
match. That verification could not be completed. Start again or continue with
Google. 2 attempts left…". Customer and dealer OTP work.

**Trace.** The title is the UI's generic failure heading
(`PHONE_TEXT.failedTitle`); the body is the server's
`ADMIN_PHONE_VERIFICATION_FAILED` message; "2 attempts left" is the client
counter (`LOCAL_ATTEMPTS = 3`) after one refusal. A wrong code yields a
different message (`PHONE_TEXT.wrongCode`), a stale Google session yet another
(`ADMIN_GOOGLE_REAUTH_REQUIRED`). So the MSG91 widget had **accepted** the code,
and the server refused the provider-verified token.

**Root cause.** For `ADMIN_ENROLL`/`ADMIN_LOGIN` only, `PhoneProofService.prove`
required the access token to carry numeric `iat` **and** `exp` JWT claims and
failed closed otherwise. MSG91 publishes neither (its docs describe the widget
JWT and `verifyAccessToken`, nothing about claims or lifetime; this repo's own
adapter notes record that token/response shapes vary by tenant). The PR's own
design doc said it "deliberately refuses admin access without them". Every test
used a fake verdict that always carried both timestamps, so CI could not see it.
A millisecond `iat` would also have been read as a far-future date and refused.

Ruled out: session-id drift (sessions do not rotate; challenge creation already
proves the admin cookie is forwarded), identifier mismatch and replay guard
(shared with the working customer flow), Google step-up and origin guard
(different messages).

**Fix (`e5a1063`).** Freshness is enforced from what the token carries: a present
`iat` must be ≥ challenge creation − 30 s and ≤ now + 30 s; a present `exp` must
not have passed; millisecond claims are read as milliseconds. An untimed proof is
accepted, logged as `phone_otp.proof_untimed` (purpose only), and bound by:
MSG91 server-side verification naming the number; permanent single use
(`admin_otp_redemptions`); the cross-purpose replay guard; browser-bound,
5-minute, 5-attempt challenges with per-number and per-IP limits; and for
enrolment, a Google step-up ≤ 10 minutes old. Customer/dealer purposes never pass
`freshAfter` and are unchanged.

**Reproduction.** New integration test "links and then signs in with
provider-verified proofs that carry no timestamps (the MSG91 widget shape)":
**403 before the fix** (identical code), 200 after; a replayed proof is still
refused. Unit tests: untimed admin proofs accepted; proofs issued before the
challenge, in the future, or expired refused; adapter handles opaque,
untimed-JWT and millisecond tokens.

**How to confirm against production logs.** The failed owner attempt should have
logged `event: phone.verify.refused, purpose: ADMIN_ENROLL, reason: "proof
freshness unavailable or expired"`.

## Other review findings

| Sev     | Finding                                                                                                                                                                                         | Resolution                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| P1      | Owner-reported enrolment failure (above).                                                                                                                                                       | Fixed `e5a1063`.                                |
| P3      | IP-quota test pre-filled only `::ffff:127.0.0.1`, so it failed on runners connecting over plain IPv4.                                                                                           | Test pre-fills every loopback form (`e5a1063`). |
| P3      | `admin-mobile-otp.md` described the fail-closed rule and carried PR-number / DO-NOT-MERGE status; `admin-mobile-otp-implementation.md` was a checkpoint log.                                    | Doc corrected; log moved here (`e9e8939`).      |
| P3      | Challenge-level refusals in `admin-phone.service` audit without a reason, unlike proof-level refusals.                                                                                          | Noted.                                          |
| P3      | `admin_otp_challenges.sessionId` → `sessions` is `ON DELETE RESTRICT`; nothing deletes sessions today, but a future pruning job must clear challenges first. No challenge retention job exists. | Noted.                                          |
| Rollout | Admin sessions move to `dd_admin_session`: existing admins sign in again; web and API must deploy together (either alone makes the console unauthenticated until the other lands).              | Rollout note.                                   |

Security posture confirmed: OTP never creates an admin; only admitted console
members can enrol; enrolment needs a ≤10-minute Google session; challenges are
purpose-bound, browser-bound, single-use, 5-minute, 5-attempt, rate-limited per
number and per IP (fails closed when the limiter is down); replay refused;
disabled/suspended members refused at redemption; strict Origin + Fetch-Metadata
on every mutation; no raw numbers in audit/logs.

## Executed checks (Node 24.21.0, PostgreSQL 16.15, `e5a1063`; `e9e8939` = docs)

| Check                                                                      | Result                                                                           |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| lint + typecheck                                                           | PASS (lint re-run on `e9e8939`)                                                  |
| tests                                                                      | contracts 468 · web 1,527 · API 3,212 — includes every customer/dealer OTP suite |
| build                                                                      | PASS                                                                             |
| API: admin token in customer cookie `dd_session`                           | 401 (session isolation)                                                          |
| Browser 390 px — Google-session admin links a mobile on Profile → Security | linked; page shows `+91 ••••••1234` and revoke control                           |
| Browser — fresh context, `/admin/login` → Mobile OTP                       | lands on `/admin`; cookies: `dd_admin_session` only                              |
| Browser — customer OTP sign-up on `/login`                                 | lands on `/`; cookies: `dd_session` only; `/admin` → `/admin/login`              |

Local provider is the fake driver (it carries timestamps); the untimed MSG91
shape is covered by the integration test, not the browser run.

## Not verified — launch item

**Real MSG91 tenant.** Not available here. Before relying on admin mobile login
in production: link an approved test number on a deployment of this commit,
sign in with it, and check the API logs for `phone_otp.proof_untimed` (present ⇒
tenant tokens are untimed and the fix is what made it work; absent ⇒ tenant
tokens are timed and freshness is enforced from them). Google admin sign-in
remains available throughout.

## CI on `e9e8939`

| Check                           | Result  | Run                                                                                      |
| ------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Vercel Preview Comments         | success | https://github.com/shashikiran6sk/DealersDrive/runs/114584323854                         |
| terraform fmt / validate        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38177963380/job/114584323755 |
| dependency audit                | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38177963380/job/114584323712 |
| lint · typecheck · test · build | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38177963380/job/114584323545 |
| semgrep                         | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38177963365/job/114584269097 |
| gitleaks                        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38177963365/job/114584268966 |
| Vercel                          | success | https://vercel.com/dealers-drive/dealersdrive-prod-web/BiXGY3sJ9vPBn9LFqF3r4RYGrixU      |
