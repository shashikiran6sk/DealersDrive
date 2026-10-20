# api / modules/legal

Parent: [api](../README.md)

Legal routes record current, explicit contractual acceptance and a distinct privacy notice acknowledgment. Authority comes from the session and current owner membership, never client actor IDs. Sharing uses a separately versioned scope and immutable grant/withdrawal history; per-enquiry disclosures reference that grant. Publication metadata is immutable, and production collection checks source approval, non-draft notice versions and matching effective policy hashes. Existing-account history recognizes verified identity merges without rewriting earlier subjects.

Cross-module consumers use legal.facade.ts. Source snapshots remain in contracts/Git; PostgreSQL stores minimal evidence and effective metadata, not policy editing content. Detailed locking, compatibility, rollout and custody decisions are in [consolidation and consent](../../../legal/CONSOLIDATION_AND_CONSENT.md).

### `legal-release.ts` — `requireLegalRelease`

The customer withdrawal controls (`POST /v1/enquiries/:id/withdraw-sharing` and `POST /v1/enquiries/sharing-permissions/:id/withdraw`) are irreversible. They write append-only evidence and suppress a dealer's existing lead. Their wording and scope are part of the same unapproved legal release that keeps the policy pages hidden. So in production they return `422 LEGAL_NOT_ACTIVE` until `legalReleaseReady()`, using the same production test (`APP_ENV`) as the publication check in `legal.evidence.ts`. Outside production they stay open for review. The web `/data-rights` page follows `legalPagesVisible()` for the same reason.
