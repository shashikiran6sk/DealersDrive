# F107 account controls — owner-approved amendment

Approved in conversation on 15 October 2026: both temporary customer deactivation and a separate account-deletion request control on Android and the website. This extends F107's UI/backend scope; the ten-PR ancestry, unmerged state and production authorization boundaries are unchanged.

## Temporary customer deactivation

- Require explicit confirmation and a fresh verified OTP/customer authentication before deactivation; stale credentials cannot perform it. Reuse the existing phone-proof and identity system.
- Apply a dedicated customer-access state, not the global User status or an administrative role suspension. Dealer/admin/sales membership and sessions must remain unaffected for multi-role users.
- Atomically revoke customer sessions and withdraw future sharing through PR #279's existing immutable grant/withdrawal services, including legacy enquiry disclosure. Existing delivered information cannot be recalled.
- Preserve saved cars, enquiry/support history and legal evidence. Deactivation is not data deletion.
- Reactivation requires fresh OTP and explicit confirmation. Administrative suspension remains authoritative and cannot be cleared by this flow. Previously withdrawn sharing permissions are never restored; a later enquiry requires a fresh valid grant under the authoritative legal rules.
- Add customer-only endpoints/contracts/OpenAPI as needed; keep bearer access restricted to customer routes. Preserve legacy login responses unless a verified, additive compatibility adaptation is necessary. Web/mobile must handle deactivated identities consistently, without creating duplicate Users.
- Add strict authorization/recency/race/idempotency/account-linking tests, session revocation tests, multi-role regressions and both platform controls. No production enablement is authorized.

## Separate deletion-request path

Prominent Android/web controls initiate an authenticated request through the existing support channel; a discoverable public website resource also provides an external contact/request path. Use clear wording about verification, deletion versus retention, and expected follow-up. Do not label intake or deactivation as completed erasure. No blind global User deletion or immutability-trigger bypass is permitted.

The exact deletion fulfilment procedure, staff responsibility, response period, retained categories/legal bases/durations, shared-role handling, provider/backups and completion evidence remain unresolved and require owner/legal review. Prepare a reviewable runbook and status evidence using existing support functionality. Production launch remains blocked until a tested fulfilment process and disclosures are approved; no arbitrary retention period will be invented.

## Release and rollback

Google Play requires an in-app deletion path and a functional web request resource; temporary deactivation alone is insufficient. Source checked 15 October 2026: [official account-deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

Any additive migration must precede its dependent backend release through separate authorization. Rollback must retain customer deactivation enforcement, revoked sessions and immutable withdrawal records; reverting to a binary that ignores these states can reopen access or disclosure. Native/web UI rollback may hide entry points, but cannot undo recorded withdrawal or reinstate sessions. Main, PR #279, production resources and publication remain untouched.
