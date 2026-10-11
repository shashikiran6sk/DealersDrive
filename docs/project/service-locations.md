# Service locations — campaign PR 4

New dealer onboarding starts in Tamil Nadu only, with its 38 districts enabled.
City/town remains separate free text. States and districts have stable internal IDs,
canonical display names, active switches, onboarding switches, and independent district
photography coverage. Geography is retained when service eligibility is disabled.

The initial state/UT inventory follows the [Integrated Government Online Directory](https://igod.gov.in/sg/states).
UT classification was checked against the [Ministry of Home Affairs](https://www.mha.gov.in/en/division_of_mha/AGMUT_Cadre_Management).
The district list and spelling follow [Tamil Nadu Lok Bhavan](https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/), checked 10 October 2026.
IDs are application identifiers, not asserted LGD codes. Reviewed historical spellings
remain accepted aliases; arbitrary misspellings are not guessed.

## Administration and future expansion

Admin → Configuration → Service Locations shows all 36 configured states and UTs.
Enable a state, add any missing districts using canonical government names and an HTTPS
`.gov.in`/`.nic.in` source with explicit review, then explicitly enable each district.
The initial migration loads only Tamil Nadu's districts; future districts are maintained
through this reviewed workflow without code changes or redeployment. A state switch does
not activate its districts or claim photography coverage. Inactive records remain stored.
Every save checks the version and records its before/after settings in the existing audit.

The public selector reloads eligible data without cache. It supports search, keyboard
selection, touch selection, and immediate visible state/district values. Actual admission
revalidates eligibility under database locks. Existing car/dealer filters and dealer slugs
are preserved; reviewed old district URL spellings map to canonical filter equivalents.

## Migration and rollout

Run `20261010090000_service_locations` and then `20261010090100_service_location_audit_index` before the application release. The second migration builds a partial history index concurrently so unrelated audit writes remain available; it must not be wrapped in a transaction. If concurrent index creation is interrupted, inspect and remove only an invalid index before retrying the failed migration through the normal Prisma recovery workflow. It is additive
and transactional, seeds master data, creates foreign keys/indexes, and backfills only
exact reviewed aliases. Dealer IDs, memberships, vehicle/listing ownership, city values,
and media are preserved. Ambiguous or unconfigured locations keep their original text,
null references, and `locationReviewRequired=true`; review these before changing them.
Do not silently assign a district. The migration does not suspend existing dealerships.

The short dealer-table ALTER and backfill require normal maintenance planning. Rehearse
on a sanitized production-sized snapshot before rollout; avoid peak writes. No production
migration was executed in this campaign. After commit prefer a forward fix; rolling back
the application can keep additive tables and columns. Never drop new references after
new registrations have used them. Seed fixtures now resolve references through the same
catalogue without overriding operational enablement switches.

## Owner UAT

1. Open self/assisted onboarding: state choices contain Tamil Nadu, district search includes
   all 38 districts, and city remains separately editable. Select once and confirm visibility.
2. Submit a valid form; inspect canonical state/district persistence. Forge a disabled or
   cross-state district request and verify rejection.
3. Change district/state availability in Configuration; confirm new onboarding changes
   immediately while existing listings and unrelated dealer edits remain functional.
4. Enable a future state, add reviewed districts, then enable a district separately. Confirm
   photography remains disabled until explicitly selected.
5. Open two configuration sessions and save stale settings: one succeeds, the stale one
   gets a reload instruction. Inspect audit history.
6. Check `/cars` and `/dealers` location filters, town search, pagination and old district links
   at phone and desktop widths. No production deployment is authorized.
