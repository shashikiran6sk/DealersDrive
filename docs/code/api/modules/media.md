# api / modules/media

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/media/media.docs.ts`

### `export const mediaDocs: ModuleDocs =`

C14, plus the two storage routes that stand in for R2 locally.

The upload contract is presign → PUT → commit, and it is that shape for one
reason: photo bytes never pass through this API. A dealer uploading twelve
4 MB photos would otherwise occupy a request worker for the duration of each,
and image processing would compete with request handling for CPU.

### `]`

── Reconstruction slice ──────────────────────────────────────────────
`PUT /v1/dealer/vehicles/:id/media/order` — `reorderVehicleMedia` — is
**F035**. It needs `VehicleMedia` and `ReorderMediaInput`, neither of
which exists yet, and `buildSchemaCatalogue()` would throw on the
missing input schema. It returns with that feature, alongside
`service.reorder()` and the route itself in `media.routes.ts`.

### `export const storageDocs: ModuleDocs =`

The two routes that stand in for Cloudflare R2 in local development.

Mounted outside `/v1` on purpose: they are storage, not API surface. In
production these are R2 and the Cloudflare Images origin, and no client code
changes — the presign response already points wherever the bytes should go.

## `apps/api/src/modules/media/media.facade.ts`

### `export { toMediaStatus } from './media.service.js'`

`media` as other modules see it (ARCHITECTURE §5.5 rule 3).

`toMediaStatus` maps a stored status onto the one the dealer is shown, and the
vehicle DTO has to render it. The processing pipeline behind it does not
leave this module.

## `apps/api/src/modules/media/media.routes.ts`

### `const MEDIA_ROUTES: MediaRoute[] = [postMediaPresign, postMediaCommit, getMedia, deleteMedia]`

C14 — dealer-scoped media.

Every route is `requirePermission`-guarded and takes its `dealerId` from the
session, never from the path: `/media/:id` is looked up as
`{ id, dealerId }`, so another tenant's upload reads as absent rather than
as forbidden.

### `const STORAGE_ROUTES: StorageRoute[] = [putUploads, getMediaImage]`

The endpoints that stand in for R2 locally.

`PUT /uploads` terminates the presigned upload: it verifies the HMAC, the
expiry, the declared content-type and the declared content-length before a
byte is written — the same conditions an S3 presigned PUT enforces. It is
mounted outside `/v1` because it is storage, not API surface.

## `apps/api/src/modules/media/media.service.ts`

### `export interface MediaDeps`

Presign → the client uploads straight to storage → commit.

The API never touches image bytes on the upload path. That is the whole
design (§12.1): a 10MB photo would otherwise occupy a request thread for the
length of the upload, and twenty of them would occupy twenty.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline file is 365 lines and carries three features. What is here is
F033's half — presign, commit, get, remove and serve. Deferred:

· `process()` — the sharp/blurhash derivative pipeline, **F034**. Nothing
calls it yet; `media.process` is enqueued by `commit()` below and no
handler is registered, so a committed upload stays PENDING until F034.
· `reorder()` — position and the primary photo, **F035**.

Every method that reaches `Vehicle` or `VehicleMedia` is also cut back:
neither model exists (F055 and F035), and the vehicle half of media is what
they add. Each cut is marked where it happens.
────────────────────────────────────────────────────────────────────────────

### `async presign(dealerId: string, input: MediaPresignInput): Promise<PresignResponse>`

C14 presign. The API validates the declared mime, size and quota,
creates a PENDING `Media` row with `dealerId` **from the session**, and
hands back a URL with the content-type and content-length baked into the
signature (§12.1).

── Reconstruction slice ──────────────────────────────────────────────
The baseline first loads the vehicle and refuses a 21st photo:

    if (input.ownerType === 'VEHICLE') { … MAX_PHOTOS_PER_VEHICLE … }

`Vehicle` is **F055**. The quota returns with it — and it has to, because
nothing else enforces the cap.

### `async commit`

Commit. HEADs the object and verifies that what landed matches what was
presigned, then enqueues processing. Never trust `Content-Type` — the
worker checks magic bytes and fully re-encodes (§12.2).

── Reconstruction slice ──────────────────────────────────────────────
The baseline upserts a `VehicleMedia` row here, which is what gives the
upload its position. `VehicleMedia` is **F035**; `position` is accepted
and echoed back so the contract and the client are unchanged, but nothing
is linked until then.

### `async get(dealerId: string, mediaId: string): Promise<VehicleMediaDto>`

The poll the uploader runs until processing reports READY or FAILED.

── Reconstruction slice ──────────────────────────────────────────────
The baseline reads `position` off the `VehicleMedia` link and `isPrimary`
off `vehicle.primaryMediaId`. Both are **F035**. The defaults below are
what the baseline itself answers for an unlinked upload, so the shape a
client parses is unchanged.

### `async remove(dealerId: string, mediaId: string): Promise<void>`

── Reconstruction slice ──────────────────────────────────────────────
The baseline does three more things here, all of them about the vehicle
this photo belongs to: it refuses the delete when it would drop a **live
listing** below `listing.minPhotos`, it removes the `VehicleMedia` link,
and it promotes the next photo to primary. Those need `Vehicle`
(**F055**), `Listing` (**F064**) and `VehicleMedia` (**F035**).

⚠️ The guard is the one that matters: without it a dealer could empty a
live listing's gallery. It must come back with F064, and the
`PlatformConfigService` dependency the service drops here comes back
with it.

### `async serve`

Resolves a delivery request to stored bytes. Content-addressed, immutable.

### `export function toMediaStatus(status: string): 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'`

`ORPHAN` is a storage-lifecycle state, not something a dealer can act on —
the contract exposes four states and a deleted upload reads as FAILED.
