# Shared storefront presentation

One Next.js 15 application in `apps/storefront` serves every registered dealer
hostname. It reads the real Host, never a query tenant or untrusted forwarded
host, and authenticates the host assertion to the existing API with a server
secret. Local hostname overrides work only outside production. No dealer
administrative routes, credentials, inventory mutations or customer sessions
are hosted on dealer domains.

LIGHT and DARK share `packages/storefront-ui` presentation, route data,
inventory behavior, galleries, contact and enquiry links. Light uses a split
hero and spacious neutral cards; Dark uses an overlay photographic hero and
denser charcoal cards. Dealer accent colors get a contrast-tested black or
white button foreground. The shared package also powers the authenticated
dashboard preview; it has no business-logic fork.

Routes: homepage, inventory with server filters/pagination, ACTIVE car detail,
about, contact, website/privacy disclosures and verified-customer enquiry
handoff. RESERVED is a non-navigable card; detail and enquiries fail server-side
for unavailable cars. Related inventory comes from the same tenant query.
Responsive images use existing processed storage derivatives, no private
signed URLs, with safe missing/storage-failure fallbacks. The native gallery
dialog supports keyboard dismissal, photo selection and focus return.

HTML and APIs are dynamic and uncached. Request-local React memoization avoids
duplicate tenant/detail queries without retaining state across tenants or
requests. Metadata/canonicals/structured data use the verified primary domain.
Secondary domains redirect through a fixed-origin URL builder. Non-production
is noindex; unknown tenants have noindex root defaults. robots and paginated
sitemap routes fail closed and return 503 on infrastructure failure. Sitemap
queries exclude RESERVED/SOLD/WITHDRAWN, use 1,000-entry pages and current
listing/vehicle timestamps; no fixed one-page truncation.

The `/enquire` handoff uses a signed, expiring backend intent, validates its
central destination, then redirects to the marketplace's `/website-enquiry`.
The central page reuses CustomerLogin and verified-account identity. Explicit
consent precedes submission to the existing source-bound enquiry API. The page
is noindex and uses no-referrer; no ticket/service secret enters telemetry.
No independent storefront login or inventory management exists.

Website disclosures describe actual data sharing and service-provider
attribution without inventing warranties or legal commitments. Qualified legal
review and reconciliation with PR #279 remain prerequisites before enablement.

The component sandbox includes Light/Dark, empty inventory, missing images,
long business names and private preview. UI tests cover both themes, keyboard
navigation, native dialog selection, reserved controls, filters/pagination,
contact/image omissions, 4.5:1 accent contrast and absence of competitor
attribution. Tenant/SEO/redirect/API-failure tests accompany the app; the
existing integration suite covers the sitemap API and tenant isolation.

Local running-app review uses only `dealersdrive_white_label_qa`, synthetic
dealer accounts and labelled inventory. The existing repository showroom asset
is identified as test presentation photography. The Light homepage was reviewed
at 320, 375, 390, 768, 1024 and 1440 pixels with no horizontal overflow and a
desktop screenshot saved. Browser automatic approval later failed due to its
usage limit; remaining visual review is unverified, not claimed as passing.
Logs, screenshot and responsive measurements live only on `testing_branch`.

Hosting remains disabled in the new Vercel config. Configure a single project
with root `apps/storefront`, existing monorepo install/build conventions,
Mumbai region, API connectivity and server-only service/IP-forward secrets.
The API feature and default-domain readiness flags remain off until real
provider/DNS/TLS checks. No project creation, production deployment or live
DNS change is performed by this layer.
