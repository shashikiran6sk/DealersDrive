# web / features/admin/portfolio-moderation

Parent: [web](../../../README.md)

The reviewer queue for dealer portfolio photographs at `/admin/portfolio`
(**#299**).

## `apps/web/src/app/(admin)/admin/portfolio/page.tsx`

### `export default async function AdminPortfolioPage({ searchParams })`

Reads the queue uncached with the contract's `PortfolioModerationQuery`, so a
status the queue does not have falls back to Awaiting review rather than
becoming a 400. A 403 — the operator is in the console but is not a MODERATOR
or SUPER_ADMIN — renders a short "you do not have access" panel instead of the
error page: the operator did nothing wrong, and the nav already hides the item
from them, so reaching it means a typed or shared URL.

## `apps/web/src/components/admin/admin-nav/admin-nav.constants.ts`

### `ADMIN_NAV` — Dealer photos

Beside Dealers, gated on `admin:portfolio:moderate`, so Support and Sales
operators are not offered a queue that answers them 403.

## `apps/web/src/features/admin/portfolio-moderation/portfolio-moderation-card.tsx`

### `export function PortfolioModerationCard({ photo }: PortfolioModerationCardProps)`

**A replacement is judged beside what it replaces.** The question for a
replacement is not "is this an acceptable photo" but "should this take the
place of the one buyers see now", so the approved image (`replacesPreviewUrl`)
is shown next to the proposed one. When the approved photo has since been
removed the slot says so: approving then simply adds a photograph.

Reject needs a reason of at least six characters (the API's `ReasonInput`) and
the dealer reads it word for word, so it is the same open-then-confirm shape as
the profile-change review. Both decisions go through the existing Server
Actions with the dealer's slug, which revalidates the public page an approval
changes.

Every image here is a short-lived signed read of a private object, rendered
with a plain `<img>`: `next/image` would proxy and cache a URL that is meant to
expire.

The intro states that photos do not affect Dealer Verified, because a reviewer
approving a photograph should not think they are vouching for the dealership.
