# web / components/dealers/dealer-gallery

Parent: [web](../../../README.md)

## `apps/web/src/components/dealers/dealer-gallery/dealer-gallery.tsx`

### `export function DealerGallery({ photos, brandName, className }: DealerGalleryProps)`

The approved portfolio photographs (**#299**) on the dealership's own page,
`/dealers/[slug]`, between the details and the inventory. It reads
`profile.portfolio`, which the API fills with approved photographs only, so the
component has no status to check and no way to show a pending one.

It renders nothing for a dealership with none — no heading over an empty grid —
and the cover band above keeps `coverUrl` (the first approved photograph, or
the slot). The gallery repeats the first photograph rather than skipping it:
the cover is a crop, and the gallery is the only place its caption is read.

**Directory cards do not use it.** The directory keeps the one standard image
for every dealer (#289) — a grid of dealers is compared at a glance, and one
dealer with a professional photographer and one without should not read as a
difference in the dealerships. A portfolio photograph appears only on the
dealership's own page.
