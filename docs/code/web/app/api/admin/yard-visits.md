# web/app/api/admin/yard-visits

Parent: [web/app/api/admin](README.md)

The BFF the internal yard-visit panel uploads photographs through (**#299**).
Only the signing and the commit pass through Next — the bytes go straight from
the browser to storage on the presigned PUT. Both calls need the admin session
cookie and the API origin, neither of which belongs in a browser bundle
(rule 9). `apiSend` picks the admin cookie because the path starts `/v1/admin/`.

Both routes reuse `proxyJson` from `lib/sales-bff.ts`: parse the body with the
contract the API validates with (an unknown field is a 400 here), forward, and
pass a 4xx problem body through unchanged so the panel can show the API's
sentence. A dealer or visit id that is not a UUID is refused before the API is
asked (`lib/admin-bff.ts`).

The endpoints need `admin:visit:manage`; a Support admin gets the API's 403
through these routes too, though the panel is never rendered for one.

## `apps/web/src/app/api/admin/dealers/[id]/yard-visits/[visitId]/photos/presign/route.ts`

### `export async function POST(`

`YardVisitPhotoPresignInput`, then
`POST /v1/admin/dealers/:id/yard-visits/:visitId/photos/presign`, answered 201.
A 409 `YARD_VISIT_PHOTO_LIMIT` passes through.

## `apps/web/src/app/api/admin/dealers/[id]/yard-visits/[visitId]/photos/commit/route.ts`

### `export async function POST(`

`YardVisitPhotoCommitInput`, then the commit, which checks the stored object's
type and size and answers the visit. Nothing public is revalidated: the
photographs are private staff evidence and appear on no page a buyer or the
dealer can reach.
