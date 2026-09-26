# api / modules/vehicle-images

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

Vehicle images (**R45**; F035 as reinterpreted). Dealers-Drive photographs the
car, StudioCar processes the pictures, and an admin uploads the finished files
here. Nothing in this module talks to StudioCar.

## `apps/api/src/modules/vehicle-images/vehicle-images.service.ts`

### `export function vehicleImageKey(vehicleId, mediaId, mimeType)`

The storage key is the server's: `vehicles/{vehicleId}/{mediaId}/original.{ext}`.
The vehicle comes from the listing in the path, the media id is generated at
presign, and the extension from the declared (and later verified) type. The
client names a file, never a path, which is what makes attaching another
vehicle's object impossible rather than merely checked.

### `async presign(listingId, input)`

Refuses a listing that is not in review (`409 IMAGES_CLOSED`) and a vehicle
that already carries `VEHICLE_IMAGE_MAX` images (`409 VEHICLE_IMAGES_FULL`)
before creating anything. The `media` row records `ownerType VEHICLE`,
`uploadedByAdmin`, and the listing's `dealerId` — the vehicle's tenant, so a
dealer-scoped query over media still sees what belongs to them.

### `async commit(admin, listingId, mediaId)`

The verification happens here, outside the transaction, because it reads the
object from storage:

1. The media row must be a VEHICLE upload made by an admin **for this
   vehicle** — its key must start with this vehicle's prefix. Anything else is
   the same `404 UPLOAD_NOT_FOUND` as an id that does not exist.
2. The object's length must equal the declaration (`422 UPLOAD_MISMATCH`).
3. Its first bytes must be a JPEG, PNG or WebP signature **of the declared
   type** (`422 UPLOAD_NOT_IMAGE`). A PNG declared as a JPEG fails too: the
   declared type is what the object will be served as.

A failed check marks the row `FAILED` and deletes the object, so a refused
file is not left in the bucket.

The attach itself is under the listing's row lock, re-checking that the listing
is still in review and the gallery has room. The row moves `PENDING → READY`
with a conditional `updateMany`: when two commits of the same upload race, the
second finds nothing to claim and returns the gallery unchanged, so the image
is attached exactly once and both callers see success. An already-attached
upload short-circuits the same way — commit is idempotent.

The new image goes at `position = count`; the first image on a vehicle is the
primary.

### `async remove(admin, listingId, mediaId)`

Deletes the attachment, marks the media `ORPHAN`, renumbers what is left to
`0…n-1`, and — if the primary went — makes the new first image primary, all in
one transaction under the listing lock. The object is deleted after commit: a
rollback never leaves a row pointing at a deleted file.

### `export const IMAGE_OPEN_STATUSES`

`PENDING_REVIEW` and `CHANGES_REQUESTED`, the same window as the photography
status. A live, sold, rejected or removed listing's gallery is history.

### `async images(vehicleId, status)`

What the review screen shows: each image with a signed read URL valid for
fifteen minutes (the page is re-rendered long before a moderator could need
more), `min` from the platform config key `listing.minPhotos`, `max` from
contracts, and `canEdit`. The moderation module reads it through this service
rather than repeating the query.

## `apps/api/src/modules/vehicle-images/vehicle-images.repository.ts`

### `export async function renumber(tx, order)`

Positions are unique per vehicle by a `DEFERRABLE INITIALLY DEFERRED`
constraint, so rows can pass through each other while the transaction shifts
them and the constraint is checked once, at commit. At most one primary per
vehicle is a partial unique index; the service always clears before it sets.
