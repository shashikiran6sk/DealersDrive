# api / modules/dealer-photos

Parent: [api](../../README.md)

Dealer photographs (partially revises **R45**). R45 made Dealers-Drive the only
photographer. A dealer may now photograph the car themselves — but a dealer's
photograph is never published as it is. It is raw material: the review team
downloads it, checks it against the ten-shot photo standard, processes it in
StudioCar and uploads the finished file through the existing admin image routes
(`modules/vehicle-images`) with credit `DEALER`. Only that file can reach a buyer,
and the public vehicle page already tells the buyer the dealer took it.

Everything is behind `feature.dealerPhotos`, which ships **off**: every write is
`409 DEALER_PHOTOS_DISABLED` and submission asks for nothing new.

## Why a separate table

Raw photographs live in `vehicle_submission_photos`, not `vehicle_media`, and
their `media` rows have owner type `VEHICLE_SUBMISSION`. `vehicle_media` is the
public gallery: the search mapper, the vehicle page and the media route all read
it. Keeping raw files out of it means no public read path has to remember to
exclude them — and the public media route (`modules/media/media.service.ts`,
`isPubliclyServable`) refuses any owner type it does not name, so this one is
refused by default. The integration test asserts a raw photograph 404s publicly
even after its car is live.

## `apps/api/src/modules/dealer-photos/dealer-photos.service.ts`

### `export function submissionPhotoKey(vehicleId, mediaId, slot, mimeType)`

`vehicles/{vehicleId}/submitted/{mediaId}/{slot}.{ext}`. The slot travels in the
server-chosen key rather than in a second table or a commit body, so commit
cannot attach a file to a slot it was not presigned for. `slotOfKey` reads it back.

### `async setPlan(actor, vehicleId, plan)`

`DEALERS_DRIVE` needs the dealership's district to have `photographyAvailable`
(the admin's service-locations switch; the seed turns it on for every Tamil Nadu
district, so operations must narrow it to where the team actually shoots —
today, Vellore). Changing the plan keeps the photographs already uploaded: a
dealer asked for changes may switch either way.

### `async commit(actor, vehicleId, mediaId)`

The same verification as an admin upload — the stored object's length against the
declaration, its first bytes against JPEG/PNG/WebP — then, under the listing lock,
the photograph is attached. A standard slot holds one photograph (a partial unique
index, `WHERE slot <> 'EXTRA'`), so a second upload replaces the first and the old
file is queued for deletion. Up to `DEALER_PHOTO_EXTRAS_MAX` extras.

### `async adminSubmitted(listing)`

For the review screen, ordered by slot and named as a StudioCar batch —
`TN23AB1234-01-front-three-quarter.jpg` — so a folder of downloads is already in
order. The URLs are 15-minute signed reads.

## `apps/api/src/modules/dealer-photos/submission-readiness.ts`

### `export async function assertPhotosReady(tx, listing)`

Inside the submit transaction: a plan is required (`422 PHOTO_PLAN_REQUIRED`); a
`DEALER` plan needs all ten standard shots (`422 PHOTOS_INCOMPLETE`, one field
error per missing slot, `photos.<SLOT>`); a `DEALERS_DRIVE` plan needs coverage
still to be there (`422 PHOTOSHOOT_UNAVAILABLE`). Only dealer submissions are
checked — a Sales Representative is Dealers-Drive staff at the yard.

### `export async function releaseSubmissionPhotos(tx, vehicle, actorId)`

A draft deleted with photographs on it: the rows go with the vehicle by cascade,
the media rows are marked `ORPHAN` and the files are queued for deletion in the
same transaction. Injected into the vehicles service rather than imported, like
the submission gate, so the service still constructs without it.
