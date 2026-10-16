# Native saved cars and account agreements

F104 uses the existing customer User and SavedVehicle records. PUT/DELETE remain idempotent, server-authorized operations; mobile adds no independent favourites store. The list preserves sold/unavailable entries, dealer access and removal controls without opening withdrawn inventory. Profile displays the verified name/phone read-only because no customer edit endpoint exists.

## Complete saved-state hydration

The legacy slug endpoint stops at 500. Optional strict limit/cursor query controls now expose keyset pages, preserving the exact legacy response when no query is supplied. No migration is needed. Mobile requires the page descriptor, fetches every page, deduplicates slugs and refuses cursor loops/cancellation. It does not infer unsaved state from a truncated response or a failed hydration.

SavedProvider keys private queries by customer, blocks repeated taps synchronously per customer/slug and uses confirmed server state. A successful mutation cancels stale list/state reads, updates known state and reconciles with a fresh complete read. GET failures show retry; mutations are never automatically replayed. Foreground refresh synchronizes website changes. QueryClient private data is cancelled/removed by the existing SessionManager when credentials or account ownership change. Late old-account results cannot update or invalidate the new account.

## Authentication interruption

Guest Save stores one in-memory positive save intent and opens authentication. Successful authentication binds it to that customer; the provider consumes it once and sends PUT, never a toggle. Cancellation/process death discards it. An expired known account binds its replacement intent to the previous owner so switching accounts cannot replay it. Policy-required responses open Agreements; consent acceptance explicitly resumes the owned save. An unavailable car returns the real backend error instead of success.

## Agreements

Current policy text/publication, customer status and bounded receipt history remain authoritative on the server. Terms ACCEPT and Privacy ACKNOWLEDGE are separate unticked choices and are reset on policy or account change. Submission uses existing versioned contracts. History shows the existing maximum 100 receipts; historical Terms/Privacy links open the authoritative versioned website path without credentials. Draft deployments explicitly state collection is inactive. Declining leaves protected mutations blocked while public discovery and rights/support remain accessible.

The lean legal-client export moves existing response schemas unchanged and re-exports them from the original legal module; it imports no policy archives into Android. Account deletion, sharing permissions and support arrive in their approved following milestones. Native assets, component fixtures and accessibility labels are exercised in tests; installed-device screenshots and performance remain separate required evidence.

## F111 optimistic reconciliation

TanStack Query remains the only remote-state owner. SavedProvider's per-owner/slug operation lock is transient coordination, not a second inventory store. `useMutation` cancels stale saved reads before applying optimistic membership and removing real cached rows on unsave. Every card reads that shared projection. Rollback restores only the failed membership/removed rows, so concurrent actions on another car survive. Unhydrated slug data is never promoted to a partial complete projection.

The final concurrent action invalidates the owned list and complete projection. Pending presentation lasts through reconciliation, avoiding a false empty shortlist while a newly saved row is fetched. Foreground/manual refresh does not compete with pending mutations. Repeated taps are synchronously locked. Tokens never enter query keys, mutation variables, persistent storage other than SecureStore, logs or Zustand. Logout/account changes remove customer queries and mutation-cache records; late results check captured token and owner before updating anything. Mutation retention is zero after observers finish.

Saved/unsaved hearts use neutral SVG outline/solid fill and explicit accessibility labels. Shared cards retain real availability, missing-price/photo fallbacks and dealer identity across all placements. Image failures reset when a recycled card's identity or URI changes.
