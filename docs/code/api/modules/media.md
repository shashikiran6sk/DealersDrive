# api / modules/media

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/media/media.docs.ts`

### `export const storageDocs: ModuleDocs =`

The three routes that stand in for Cloudflare R2 in local development.

Mounted outside `/v1` on purpose: they are storage, not API surface. In
production these are R2 and the Cloudflare Images origin, and no client code
changes — the presign response and the signed read URL already point
wherever the bytes are.

**R45 withdrew `mediaDocs`** with the dealer routes it described
(`/v1/dealer/media/presign`, `…/:id/commit`, `GET`/`DELETE …/:id`). A dealer
never writes vehicle media; the admin upload is documented by the
[`vehicle-images`](vehicle-images.md) module under the same tag.

## `apps/api/src/modules/media/media.facade.ts`

### `export { toMediaStatus } from './media.service.js'`

`media` as other modules see it (ARCHITECTURE §5.5 rule 3).

`toMediaStatus` maps a stored status onto the one the dealer is shown, and the
yard photograph has to render it. The processing pipeline behind it does not
leave this module.

## `apps/api/src/modules/media/media.routes.ts`

### `export function storageRoutesFor(driver: Env['STORAGE_DRIVER']): StorageRoute[]`

The endpoints that stand in for R2 locally — mounted **only for the local
driver**. Behind minio or r2 the adapter's `presignPut()` and
`signedReadUrl()` return real S3 presigned URLs, so `PUT /uploads` and
`GET /private` have no caller there. Mounted anyway, they forwarded any
request carrying a valid HMAC straight to the bucket through the configured
`StoragePort`, and `UPLOAD_SIGNING_SECRET` has a committed default: anyone
could overwrite a live vehicle image, plant objects in another dealership's
KYC prefix, or read a private document by key (ORIG-BUG-001). The public
`GET /media/by-media/:mediaId/:width.webp` stays for every driver; it is gated
by listing and dealer visibility, not by a signature. `createStorageRouter`
takes the driver as a parameter (defaulting to `env.STORAGE_DRIVER`) so the
choice is testable without reloading configuration.

`PUT /uploads` terminates the presigned upload: it verifies the HMAC, the
expiry, the declared content-type and the declared content-length before a
byte is written — the same conditions an S3 presigned PUT enforces.

`GET /private` answers the local adapter's `signedReadUrl()`: the key, its
expiry and an HMAC over both, signed with the literal content type `read` so a
read URL can never be replayed as an upload. Before R45 the local adapter
handed out `/private/<key>` URLs that nothing served, so a yard photograph or
KYC preview was a broken image in development; the moderator's preview of an
unpublished vehicle image is what made it matter. An expired, altered or
misdirected signature is a plain 404 — never a hint about which part failed.

**The dealer media router is gone (R45).** It took an `ownerType` and a
client-supplied `ownerId` and put the latter in the storage key without
checking that the dealer owned it. Rather than repair a route the product no
longer has a use for, it was removed: there is no dealer path that writes
vehicle media at all.

## `apps/api/src/modules/media/media.service.ts`

### `async serve`

Resolves a delivery request to stored bytes. A new upload has a new id, but authorization and readiness remain mutable.

**A vehicle image is public only while its listing is visible — `ACTIVE`, or
`RESERVED` since R71, because a reserved car's card and page are still shown
(R45, R71), and its dealership is `ACTIVE`.** The rules are contracts' `isListingPubliclyVisible` and the shared search `PUBLIC_DEALER_STATUS`, the same ones the
search's visible predicate spells. The media row is read with its
`vehicle_media` attachment, the vehicle and the listing, and anything else — a
pending review, changes requested, rejected, sold, withdrawn, or an image
attached to nothing — is the same 404 as an id that does not exist. A moderator previews unpublished images through a signed read
URL instead.

### `async function isPubliclyServable(media: ServableMedia): Promise<boolean>`

**A yard photograph is public only while it is the cover of an `ACTIVE`
dealership (BUG-NEW-009).** It used to be served whatever happened to its
dealership: during a suspension the vehicle images went 404 while the yard
photograph — the image that fronts the portfolio — stayed 200, and a DRAFT or
pending applicant's photograph was public by id before anyone had approved it.
The rule is one `count` of dealers whose `coverMediaId` is this row and whose
status is `PUBLIC_DEALER_STATUS`, so a replaced photograph stops being served
too. The dealer and the moderator see it through a signed read URL, which is
unaffected.

**Every other owner type is refused.** Only vehicle images and yard photographs
are ever delivered here. A logo has no upload path and KYC documents do not
create media rows, so this changes no current response — it means a future
owner type is private until a rule for it is written, rather than public
because nobody thought to write one.

**Widths (BUG-NEW-011).** Any whole number from 1 to 4000 passes `MediaPath`.
A width the processor wrote (320, 640, 1024, 1600) gets that derivative; any
other gets the largest one there is, then the original. The reference used to
say every other width was a 404, which a client could have coded around; it
now describes the route as it behaves.

The derivative route sets `Cache-Control: no-store` before validation and delivery, including denials. A READY image may become unavailable after suspension or a listing decision; an unchanged URL must consult the current state again. This also prevents a cached denial from outliving reinstatement. Private signed previews retain their existing authority and private/no-store behavior. Requested derivatives, larger fallbacks and original MIME types are unchanged. Previously retained client/CDN bytes cannot be recalled by this header; deployment must account for caches populated under the old year-long policy.

**Revalidate, do not re-download (R108).** `no-store` on a successful response
meant a browser never kept an image, so every view of every gallery streamed the
bytes from S3 through the API again — on the t4g.small that serves the whole
API. A successful response now sends `Cache-Control: no-cache` and a strong
`ETag`. `no-cache` lets the browser keep the bytes but forbids reusing them
without asking, so the property above still holds: every reuse is a
conditional request, and `locate()` runs the same READY and visibility checks
on it as on a first view. Still public → `304`, and `read()` (the S3 download)
is skipped. No longer public → `404` with `no-store`. Nothing is ever served
from a cache without the current state being consulted, and the public listing
APIs stay the source of truth for what is visible.

The ETag is `sha256(mediaId:key)` rather than a hash of the bytes, so it can be
known before the download. That is sound because an object's bytes never change
under its key: every key embeds the media id, a random UUID minted for one
upload, and a replacement image is a new media row. The `m1-` prefix versions
the derivation. No `max-age` or `immutable`: a bounded lifetime would let a
browser show a suspended dealer's car without asking. Private reads
(`GET /private`, KYC documents, yard previews) are unchanged — `private,
no-store` — and KYC documents never reach this route at all.

### `export function toMediaStatus(status: string): 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'`

`ORPHAN` is a storage-lifecycle state, not something a dealer can act on —
the contract exposes four states and a deleted upload reads as FAILED.
