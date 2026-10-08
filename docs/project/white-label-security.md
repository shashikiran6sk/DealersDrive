# White-label V1 security boundaries

The dashboard is the control plane; the existing API/database and inventory
remain authoritative. Storefronts provide public, tenant-scoped presentation.
Execution logs, the 40-category verification matrix, screenshots and performance
measurements live only on `testing_branch` under the corresponding PR number.

## Required trust boundaries

- Management derives dealership identity from authenticated membership, with
  owner-only website/domain mutations and manager read/preview. Transactions
  reauthorize after per-dealer locks so queued writes cannot outlive revocation.
- Storefront enquiry transactions lock and recheck the current customer session,
  identity, proved phone and applicable role status after authoritative listing
  eligibility. Dealer/vehicle routing derives from a signed, expiring origin;
  client IDs cannot redirect a lead. Consent and source remain in existing leads.
- Public tenant resolution checks a registered normalized hostname, verified
  active domain, current primary domain and website/dealer eligibility. A
  server-only service assertion protects the API boundary. User-supplied
  forwarded hosts and tenant query parameters do not identify a dealer.
- Pre-stream resolution returns noindex 404 for unknown/inactive hosts and 503
  for unavailable dependencies. Redirects use only a registered fixed origin.
  No shared HTML/data cache can serve another tenant or retain suspension.
- Inventory, filters, detail, related vehicles and public media enforce dealer,
  moderation, lifecycle and publication predicates. Saved/enquiry marketplace
  links honor the marketplace destination. Public DTOs exclude private records.
- Branding is bounded plain text and controlled HTTPS links. Owned uploads are
  MIME/byte/pixel limited, decoded and metadata stripped. Private preview media
  uses authenticated no-store handlers; approved public media rechecks eligibility.
- Domains have unique retained reservations and fresh ownership proof. Existing
  provider deployments are never silently claimed. Routing, provider verification
  and a validated pinned-IP TLS handshake precede activation. Private/mixed DNS
  results are rejected. Active ownership checks expire after 24 hours.
- Provider HTTP, DNS and TLS operations have bounded deadlines. Removal revokes
  public access before external cleanup. Partial external success needs audited
  operator reconciliation; retries never transfer another deployment.
- Media cleanup serializes against branding writes and retains referenced draft
  or disabled assets. Only worker-owned prefixes are deleted; failures retry.
  Vehicle derivatives are bounded background work, never arbitrary public GET
  processing. Source failures retain originals and delay retries to prevent
  backlog starvation.
- New sensitive writes share existing rate buckets and fail closed when counter
  storage is unavailable. Errors and telemetry omit private payloads and keys.

## Rollout risks requiring owner review

Existing dependency chains retain high and moderate advisories. Review the full
machine-readable audit on the evidence branch. High findings affect PostCSS
source-map reads, Prisma config merging/MySQL CLI, lint glob parsing and source
map processing. This feature accepts no dealer CSS/source maps or arbitrary
configuration and uses PostgreSQL. These boundaries do not replace dependency
maintenance; do not assert the advisories are eliminated. Moderate Express parser
and resolver/tooling findings also require review. Broad transitive-major
replacement needs compatibility validation.

Real provider credential scope, DNS routing/ownership, wildcard renewal, live
TLS, production performance and staging identity boundaries require external
verification. Legal/product owners must review service-provider attribution,
consent and the existing legal/privacy PR before rollout. Default flags remain
off until these prerequisites are deliberately satisfied. See
[operations and rollback](white-label-operations.md).
