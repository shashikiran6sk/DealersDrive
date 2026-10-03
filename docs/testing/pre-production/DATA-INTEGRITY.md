# Authoritative database observations

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

The final isolated DB snapshot had 11 users, 3 dealers, 5 memberships, 9 vehicles/listings, 8 enquiries, 9 saved records and 136 audit rows. These counts include intentionally retained bug fixtures and are not launch seed data. No orphan enquiry/listing references or unvalidated foreign keys were found in the inspected relationships.

The mobile browser enquiry ended CLOSED with both contactedAt/closedAt and contactedById/closedById present. STAFF saw its individual contact attribution; MANAGER saw close attribution. Admin history showed the three transitions with actor category “Dealer”; the initial harness’s extra expectation of individual names in Admin UI was not an established requirement and is classified BLOCKED. The database retains individual actors.

Revocation probes retained the draft, its dealership and creator, personal saved and enquiry records; suspension/reinstatement preserved measured rows. Individual lifecycle/migration assertions preserve SOLD enquiry history and old owner/profile/doc/session relationships. This is not a comprehensive production restore or all-table integrity certification.

BUG-003 omits records during pagination but does not delete them. BUG-002 intentionally left an incomplete dealer ACTIVE as reproduction evidence; BUG-005 intentionally left the blocked draft PENDING_REVIEW before the removed manager rejoined through a real invitation.

Evidence: [aggregate DB snapshot](evidence/concurrency/final-database-snapshot.json), [API probes](evidence/security/api-probes.json), [revocation follow-up](evidence/security/followup-probes.json), [migration assertions](evidence/ci/api-assertions.json).
