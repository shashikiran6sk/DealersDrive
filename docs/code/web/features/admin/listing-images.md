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
sent, and said so. The page is revalidated once at the end, not per file.

The image `src` is the API's signed read URL: the image is not public until the
listing is, so the review screen cannot use the public media route.

## `apps/web/src/features/admin/listing-images/image-tile.tsx`

### `export function ImageTile(...)`

Removal, _Make primary_ and the ← / → moves are plain `<form>` server actions,
like a checklist tick — no drag and drop, so every control is a button with a
name a screen reader can announce ("Move image 3 earlier"). A move posts the
**whole** new order, computed by `moved()` from the order the page rendered;
the API refuses it if the gallery changed underneath, rather than applying a
stale move to a different set of images. The primary badge and the position come from the API, which
promotes the next image when the primary is removed — the tile never decides
which image is primary.
