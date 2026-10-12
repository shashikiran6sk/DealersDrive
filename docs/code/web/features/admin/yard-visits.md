# web / features/admin/yard-visits

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/yard-visits/yard-visits-panel.tsx`

### `export function YardVisitsPanel({ dealerId, visits }: YardVisitsPanelProps)`

Internal yard visits (**#299**): when Dealers-Drive staff go to a dealership,
what they found and the photographs they took.

**Private, and the panel says so in its first line.** The visits are
operational evidence for staff. They are never served publicly, never shown to
the dealer, never required for activation, and never a route to Dealer
Verified — the Dealer Verified decision lives in its own panel and reads none of
this. A moderator who could not see that sentence would reasonably assume a
visit is a step in the approval, and start asking dealers to arrange one.

**`NO_PHYSICAL_YARD` is a legitimate outcome, not a penalty.** Plenty of real
dealerships trade from an office or from the buyer's driveway. Recording it as
found is the point; treating it as a failure would push staff to record
something else. It is rendered in a neutral tone rather than the error tone for
the same reason, and the row repeats "not a penalty" under it.

### `if (visits === null) return null`

`null` is the page's answer when the API refused the read with a 403. The
endpoints need `admin:visit:manage` (Moderator and Super admin); a Support admin
can open the dealer page but not the visits, and the dealer page must not crash
or show an empty panel that implies there are no visits. An empty array is a
real answer — "nothing recorded" — and renders as such.

## `apps/web/src/features/admin/yard-visits/yard-visit-row.tsx`

### `<img src={photo.url}`

`url` is a short-lived signed read of a private object, minted on every list
read (and audited by the API as `dealer.yard_visits.viewed`). It is never cached
or stored, which is why the page re-fetches the list after every upload instead
of appending the committed photograph locally.

## `apps/web/src/features/admin/yard-visits/yard-visit-photo-upload.tsx`

### `export function YardVisitPhotoUpload`

The same three-step upload the rest of the product uses — presign, PUT straight
to storage, commit — through the admin BFF under
`/api/admin/dealers/[id]/yard-visits/[visitId]/photos/`. The bytes never pass
through Next; only the signing and the commit do, because those need the admin
session cookie and the API origin (rule 9). The type and size are checked in the
browser first only for the message; the presign and the commit enforce them.

### `if (photoCount >= YARD_VISIT_PHOTO_LIMIT)`

The API answers 409 `YARD_VISIT_PHOTO_LIMIT` at the limit; hiding the control
there saves the moderator a round trip to a refusal.

## `apps/web/src/features/admin/yard-visits/record-visit-form.tsx`

### `const valid = CreateYardVisitInput.safeParse(body).success`

The button is enabled by the contract the API validates with, so a future date
or an over-long note is refused in the form rather than as a 400. Recording a
visit is a Server Action, not a BFF route: it is a small JSON body with no file
behind it.

### `<Input id="yardVisitDate" type="date"`

No default date. "Today" depends on the clock of whoever renders it — the
server during SSR, then the browser — and a visit is usually recorded after the
fact anyway; an empty field makes the moderator say when it happened.

## `apps/web/src/features/admin/yard-visits/yard-visits.constants.ts`

### `export function yardVisitPhotoPaths(dealerId: string, visitId: string)`

Both ids are encoded here and validated as UUIDs again in the BFF, so a hand-
edited id becomes a 400 at the proxy rather than a request the API has to parse.
