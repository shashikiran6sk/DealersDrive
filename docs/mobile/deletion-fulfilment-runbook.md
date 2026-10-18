# Account deletion fulfilment — draft approval gate

Status: NOT APPROVED / NOT IMPLEMENTED. F107 delivers intake and temporary deactivation, not completed erasure. This document is a review checklist for the owner/privacy adviser and existing support operators, not permission to delete data or publish legal claims.

## Intake available now

An authenticated customer can submit a distinct Account deletion request through Android or `/account-deletion` on the website. The existing support service binds it to the current customer and deduplicates an unchanged request UUID. A person without an active account can use the public page's configured email/contact instructions. The live configured contact must be tested and monitored before release. Staff must not ask for OTP values, session credentials, identity documents in public replies or unnecessary personal information.

## Required approvals before fulfilment

| Decision                                          | Required owner/evidence                                                                                                                  | Current state                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Responsible privacy operator and escalation       | Named owner, staffed inbox/queue and access controls                                                                                     | Unassigned                             |
| Request verification, including lost phone access | Reviewed proportional identity verification and impersonation safeguards                                                                 | Unapproved                             |
| Response and completion periods                   | Approved operational commitment and exception communication                                                                              | Unapproved; no duration promised       |
| Retained categories and legal basis               | Record-by-record matrix: identity, sessions, saves, enquiries, dealer sharing/evidence, support, audit, notification/outbox, logs, files | Unapproved; no blanket erasure promise |
| Retention periods and disposal schedules          | Counsel/owner approval with applicable commencement dates and business obligations                                                       | Unapproved                             |
| Multi-role users and linked identities            | Customer scope versus dealer/admin records; canonical/absorbed identity mapping and explicit outcome                                     | Unapproved                             |
| Delivered dealer copies and processors            | Defined notices, requests and limits; customer explanation                                                                               | Unapproved                             |
| Backups, restores and provider copies             | Reviewed expiry/suppression/reconciliation controls; no reintroduction after restore                                                     | Unapproved                             |
| Tested technical disposition                      | Independently reviewed transaction/job, authorization, audit, dry-run and rollback design                                                | Not implemented                        |
| Completion evidence                               | Verified outcome, exception explanation, restricted evidence, customer notification and ticket status                                    | Not implemented                        |

## Proposed operational sequence for review

1. Triage the existing support ticket; acknowledge intake without claiming completion. Authenticate staff through existing admin support authorization and verify the requester through the approved procedure.
2. Resolve canonical identity and all linked/customer/shared-role records. Prepare a reviewed inventory and apply the approved retention matrix. Escalate disputed identity or shared-role implications; do not globally delete a User or clear an administrative suspension.
3. Revoke customer access and future sharing through existing reviewed controls as appropriate; temporary deactivation alone does not fulfil deletion. Do not bypass immutable evidence triggers.
4. Execute only a separately approved, tested disposition implementation against the approved environment. Include race/isolation, retry, processor, restore and retained-record validation. No ad-hoc production SQL or blind cascade deletion.
5. Verify the actual outcome and lawful exceptions; record restricted evidence and notify the requester through the approved channel. Close the ticket only after outcome verification, not merely intake. Surface status through the existing support conversation.

## Release requirements and sources

Google Play's [official account-deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) require an in-app path and an accessible external resource; temporary deactivation does not substitute for deletion. Completing the intake UI alone is insufficient evidence of compliance. Review the authoritative [final DPDP Rules Gazette](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf) with qualified counsel, including phased commencement and other applicable retention duties. Do not use draft explanatory notes as final law or invent retention periods.

Production release remains blocked until this procedure, disclosures and a tested fulfilment implementation are approved. START and the two-control amendment do not authorize production erasure, policy publication, deployment or new cloud resources.

## Integration review dispositions (2026-10)

These were found in the integration review. They are recorded here rather than fixed in F107 because each one changes the API or the support model. Each is a release blocker for deletion intake, not a merge blocker.

- **Intake is an ordinary support ticket (medium).** The request is category `ACCOUNT_ISSUE` with a client-chosen subject. There is no server-set kind, status or audit event, so staff cannot filter for deletion requests and an ordinary ticket can carry the same subject. Before release, add a server-owned endpoint (`POST /v1/auth/customer/account/deletion-request`). It should set a server-owned kind, record `auth.customer.deletion_requested`, and be idempotent per open request.
- **Follow-up after deactivation (medium).** The support routes refuse a deactivated customer, so My support requests is unavailable until reactivation. The deactivation and deletion copy now says so, and points to contacting support without signing in. Whether a deactivated customer may read and reply to their own tickets is a product decision.
- **Reactivation ticket binding (low).** The ticket is single-use and lasts ten minutes, but it is not tied to a particular deactivation. Bind it to `customerDeactivatedAt`.
- **Route group allowance (low).** A deactivated person's dealer session reaching `/v1/auth/workspaces` and `/v1/invitations` is decided by a URL pattern, not an explicit guard option at the mount.
- **Error codes (low).** `ACCOUNT_UNAVAILABLE` and `ACCOUNT_SUSPENDED` describe the same condition in different routes.
- **Migration lock (low, operational).** `20261015110000_customer_deactivation` alters `sessions`. Apply it with a session-level `lock_timeout` set by the operator, so its brief exclusive lock cannot queue behind a long transaction. It is not set inside the migration, because a session setting would carry over to the later migrations of the same run.
- **Web sign-in side effect (low).** A web `REACTIVATION_REQUIRED` result clears the browser session cookie. That also signs out a dealer session open in the same browser. Confirm this is intended.
