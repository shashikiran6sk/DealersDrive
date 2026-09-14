# web / app/(admin)/admin

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(admin)/admin/layout.tsx`

### `export const dynamic = 'force-dynamic'`

DESIGN-SPEC §3.17 — the admin shell. Ground `#f5f5f8`, 206px cobalt-900
sidebar, 54px white top bar.

Desktop-first by design: at 768 the sidebar collapses to a top row and tables
scroll inside their bordered container.

### `const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false }`

── Reconstruction slice ────────────────────────────────────────────────────
The baseline spreads `seoMetadata({ kind: 'private' })` from `lib/seo.ts`
here. That file is the whole indexing policy in one function and belongs to
**F095**; what it resolves to for a `private` route is the literal below. The
same substitution was made at both sign-in screens and at the onboarding
wizard, for the same reason — a cross-tenant operations console must be
`noindex` from the day it exists.

### `const overview = await requireAdmin()`

The header badge is a live count of the queue — never a hard-coded number

### `const overview = await requireAdmin()`

(Rule 6, §4.11). It is also the guard: a 401 here means no admin session,

### `const overview = await requireAdmin()`

and every admin page sits beneath this layout.

### `{overview.headerBadge.count > 0 ?`

The badge is a link onto `/admin/listings` (**F069**), which does
not exist — but it cannot render one today: `headerBadge.count` is
the pending-listing count, and with no `Listing` model
`overview()` computes it as a hard zero. So the branch is
unreachable rather than broken, and it is left as the baseline has
it so that F069 restores the badge by adding a model rather than
by editing this file. The nav item beside it _was_ reachable,
which is why `admin-nav.tsx` is the file this feature changed.

## `apps/web/src/app/(admin)/admin/page.tsx`

### `export const dynamic = 'force-dynamic'`

DESIGN-SPEC §3.17 — six plain stat boxes (no blueprint marks in admin), then
the moderation-queue panel.

The shell has been mounted since **F049** and, until now, had no page under
it: `/admin` was a 404 that the sidebar's first nav item pointed at, and the
console could only be entered by typing `/admin/dealers`. This is the screen
the shell was built for.

It re-reads `GET /v1/admin/metrics/overview`, which the layout above it has
already read for the header badge. Two calls rather than a prop, deliberately:
`AdminLayout` cannot pass data to its children — a layout and a page are
separate server components — and the alternative is a context provider around
a value that is already `revalidate: false` and served from one process.

── Reconstruction slice ────────────────────────────────────────────────────
Five of the six counters read `Listing` (F064), `Payment` (F052) and
`Enquiry` (F088), none of which exists, so each reports zero — the true
answer with no rows. The gross/net GST split behind two of them is real and
is the part that is expensive to get wrong later. See `admin.service.ts`.
────────────────────────────────────────────────────────────────────────────

### `return stat.href ?`

A box is a link only when the API gave it an `href`. That is the
API's decision rather than this page's, and it is what keeps the
grid honest during the reconstruction: `pendingVerification` points
at `/admin/dealers`, which exists, and the five counters whose
screens have not landed carry no `href` at all.

### `</div>`

── Reconstruction slice ───────────────────────────────────────────
The baseline's `Open queue →` ghost button sits here, onto
`overview.moderationQueue.href` — `/admin/listings`, which arrives
with **F069**. Held back rather than pointed at a 404, the same way
the nav item for that route is; both return with F069.

The panel stays, because its sentence is true and is the one an
operator needs: with no listings table there is nothing waiting for
review, and the message says exactly that.
───────────────────────────────────────────────────────────────────
