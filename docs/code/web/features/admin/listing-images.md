# web / features/admin/listing-images

Parent: [web/features/admin](README.md)

## `apps/web/src/features/admin/listing-images/listing-images.tsx`

### `export function ListingImages({ listingId, images }: ListingImagesProps)`

The admin's upload of the processed StudioCar images (**R45**). It is a client
component only because it holds a file input and upload progress; everything it
shows comes from `AdminListingDetail.images`, and the minimum, the maximum and
whether the gallery may change at all are the API's (`min`, `max`, `canEdit`),
never numbers repeated here.

Files go one at a time — presign (server action) → `PUT` straight to storage →
commit (server action) — so twelve 4 MB images never pass through the Next
server, and one bad file costs one line in the error list rather than the
batch. More files than the gallery has room for are trimmed before anything is
sent, and said so. Successful commits refresh the admin pages and invalidate the shared public
vehicle cache tag, which covers vehicle pages, cards, home and dealer inventory.

The image `src` is the API's signed read URL: the image is not public until the
listing is, so the review screen cannot use the public media route.

## `apps/web/src/features/admin/listing-images/image-tile.tsx`

### `export function ImageTile(...)`

_Make primary_ and the ← / → moves are plain `<form>` server actions,
like a checklist tick — no drag and drop, so every control is a button with a
name a screen reader can announce ("Move image 3 earlier"). A move posts the
**whole** new order, computed by `moved()` from the order the page rendered;
the API refuses it if the gallery changed underneath, rather than applying a
stale move to a different set of images. The primary badge and the position come from the API, which
promotes the next image when the primary is removed — the tile never decides
which image is primary.

### Live photo maintenance

Live and reserved listings expose the same gallery controls to authorized admins.
`live` selects guidance about immediate public changes and the minimum photo
count rather than approval requirements. Photography workflow controls remain
independently locked. Replace chooses a single file, stages it using
`replacesMediaId`, uploads directly to storage, and commits through the replace
action. It works at capacity and never deletes the existing photo first.
Removal returns an action result so minimum-photo and other errors appear in
the gallery. Upload/replacement/removal disable competing gallery controls
while pending. All successful gallery mutations invalidate public vehicle
caches in addition to refreshing the admin review page.
