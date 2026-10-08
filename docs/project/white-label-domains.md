# Dealer website control plane and domain operations

My Website is inside the existing authenticated dealer console. OWNER creates,
saves branding/themes, uploads processed images, chooses publication destinations,
activates/disables and manages domains. MANAGER can read and privately preview;
STAFF has no website permission. Mobile navigation includes More so website,
profile and team pages remain reachable. Every save calls the real API and
reports success/failure. Uploads block Save until processing finishes. No fake
analytics or independent storefront inventory management is introduced.

Protected preview uses the exact shared storefront presentation. Branding images
are fetched through the authenticated web BFF; private originals, other tenants
and KYC cannot be retrieved. Preview is noindex, no-store and inert; it does not
publish drafts or turn its enquiry links into public lead endpoints. The legal
identity/address remain on the existing approved dealer record.

## Custom-domain ownership and lifecycle

1. An eligible OWNER submits a normalized hostname. A globally unique retained
   reservation belongs permanently to this dealership in V1. At most three
   non-removed custom reservations exist per website. Platform/root/provider
   hostnames, IPs, wildcard names, paths, ports and internationalized names are
   refused. The API returns a fresh `_dealers-drive.<hostname>` TXT challenge.
2. Refresh proves that exact tenant-bound TXT value via DNS. Without proof,
   no provider attachment occurs and no public response resolves the hostname.
3. The provider adapter checks the dedicated storefront Vercel project. An
   existing assignment is a conflict, never an automatic transfer. The provider
   add/verify/config APIs return actual verification and routing records.
4. Ownership, provider verification, correct routing and valid TLS are all
   required before ACTIVE. TLS probes resolve public IPv4 first, reject private,
   metadata, loopback, reserved and mixed-public/private DNS results, pin the
   resolved address, and validate the certificate for the requested hostname.
   No arbitrary HTTP fetch or disabled certificate validation is used.
5. OWNER chooses an eligible primary atomically under the unique-primary
   database constraint. Secondary storefront hosts redirect to the registered
   primary, preserving path/query with a fixed-origin URL builder.
6. Loss of ownership, routing or certificate eligibility fails closed. A lost
   primary falls back to another current domain, preferring the retained default
   reservation; without a fallback the website is suspended. Reinstating the
   dealership alone never republishes a suspended website.
7. Removal first revokes website/domain eligibility and chooses a safe primary
   fallback. Provider failure persists REMOVAL_PENDING for retry. Removed
   hostnames remain reserved, blocking cross-tenant takeover. Re-adding by the
   same owner rotates TXT proof and clears old ownership/provider evidence.

Provider calls are server-only, fixed to `api.vercel.com`, bounded by timeouts,
and have safe errors. The DB transaction serializes each dealership's domain
changes with ordinary website mutations; the worker uses the same lock. Provider
failure never affects ordinary inventory management. The new migration adds
only provider attachment tracking and a refresh index.

If a provider add succeeds but the DB transaction times out before attachment
tracking commits, retry refuses the pre-existing deployment instead of assuming
ownership. An operator must reconcile that exact project/domain against audit
and ownership proof; never move it automatically. This conservative recovery
state is deliberate. DELETE is idempotent for missing provider assignments.

Hourly `storefront.domains-sweep` uses existing pg-boss workers, refreshes ACTIVE
custom domains after 12 hours, and retries pending removals. Every public
read/submission/media response requires a custom-domain check within 24 hours.
If the worker stops or checks fail, domains become unavailable rather than
remaining trusted indefinitely. The batch is bounded to 100, oldest checks
first. Alert on check age and provider/removal failures. Failed initial setup
is retried explicitly by the owner. No provider mock is available as a
production environment option; tests inject the deterministic port.

## External configuration and verification

Set `STOREFRONT_DOMAIN_PROVIDER=vercel` on the API/worker and supply dedicated
`STOREFRONT_VERCEL_TOKEN`, `STOREFRONT_VERCEL_PROJECT_ID` and
`STOREFRONT_VERCEL_TEAM_ID` secrets. The adapter refuses incomplete configuration.
Use a project-restricted integration/token where supported; do not reuse a
marketplace deployment token with unrelated access. Never put them in browser
variables, source, logs or the storefront project.

No provider credentials, live routing, ownership TXT, wildcard DNS or actual
certificate issuance were verified in this campaign. Only supported REST
integration code, TLS/DNS boundary tests and deterministic provider workflows
were exercised. The project owner must configure and smoke-test them before
enablement; a database ACTIVE record alone is not external verification.

The default-domain readiness flag is an explicit operational attestation.
Configure one shared storefront project and wildcard DNS/TLS (or individually
verified hostnames if existing DNS delegation cannot safely change), preserve
existing marketplace/API/mail records, then smoke-test the shared storefront
before setting `STOREFRONT_DEFAULT_DOMAIN_READY=true`. Do not change live DNS
or migrate namespaces as part of feature review.

Current supported provider references:
[add project domain](https://vercel.com/docs/rest-api/projects/add-a-domain-to-a-project),
[verify project domain](https://vercel.com/docs/rest-api/projects/verify-project-domain),
[domain routing configuration](https://vercel.com/docs/rest-api/domains/get-a-domain-s-configuration),
[remove project domain](https://vercel.com/docs/domains/working-with-domains/remove-a-domain).

Qualified legal review and reconciliation with PR #279 remain required before
production publication. Website information names the dealership and
Dealers-Drive's service role without inventing commitments or warranties.
