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

### `const STORAGE_ROUTES: StorageRoute[] = [putUploads, getPrivate, getMediaImage]`

The endpoints that stand in for R2 locally.

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

Resolves a delivery request to stored bytes. Content-addressed, immutable.

**A vehicle image is public only while its listing is visible — `ACTIVE`, or
`RESERVED` since R71, because a reserved car's card and page are still shown
(R45, R71).** The rule is contracts' `isListingPubliclyVisible`, the same one the
search's visible predicate spells. The media row is read with its
`vehicle_media` attachment, the vehicle and the listing, and anything else — a
pending review, changes requested, rejected, sold, withdrawn, or an image
attached to nothing — is the same 404 as an id that does not exist. A moderator previews unpublished images through a signed read
URL instead. Other owner types (a yard photograph) are unaffected.

The response stays `immutable` for a year: once an image has been public its
bytes cannot be unpublished from a cache anyway, and the gate exists to keep
images of a car that was never approved from being fetched at all.

### `export function toMediaStatus(status: string): 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'`

`ORPHAN` is a storage-lifecycle state, not something a dealer can act on —
the contract exposes four states and a deleted upload reads as FAILED.
