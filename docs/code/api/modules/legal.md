# api / modules/legal

Parent: [api](../README.md)

Legal routes record current, explicit contractual acceptance and a distinct privacy notice acknowledgment. Authority comes from the session and current owner membership, never client actor IDs. Sharing uses a separately versioned scope and immutable grant/withdrawal history; per-enquiry disclosures reference that grant. Publication metadata is immutable, and production collection checks source approval, non-draft notice versions and matching effective policy hashes. Existing-account history recognizes verified identity merges without rewriting earlier subjects.

Cross-module consumers use legal.facade.ts. Source snapshots remain in contracts/Git; PostgreSQL stores minimal evidence and effective metadata, not policy editing content. Detailed locking, compatibility, rollout and custody decisions are in [consolidation and consent](../../../legal/CONSOLIDATION_AND_CONSENT.md).
