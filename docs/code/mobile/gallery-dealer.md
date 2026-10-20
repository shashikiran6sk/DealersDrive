# Galleries, dealer profile and inventory (F113)

## `apps/mobile/src/components/photo-gallery/photo-gallery.tsx`

### `export function PhotoGallery`

The visible Previous/Next buttons are gone (owner §7.3): the inline gallery is a horizontal paging list, the same gesture the full-screen viewer already used. The page around it scrolls vertically, and a horizontal list nested in a vertical one is the platform's own gesture split, so no responder code is needed.

TalkBack users lose nothing. The whole gallery is one `adjustable` element whose value is "Photo n of total"; swipe up/down (increment/decrement) moves between photos, and double-tap (`activate`) opens the viewer. One element rather than a focus stop per photo keeps a twenty-photo dealership from becoming twenty swipes to reach the address.

The list width is measured, not assumed. The gallery sits inside page padding, so paging by the window width would land each photo off-centre; the measured width also re-aligns the current photo after rotation.

One photo is shown without dots, counter or paging actions; no photos keep the existing placeholder.

### `MAX_GALLERY_DOTS`

Past seven photos the dots stop meaning anything on a phone and the counter alone is shown.

## `apps/mobile/src/components/photo-gallery/photo-viewer.tsx`

### `export function PhotoViewer`

`onClose` hands back the photo the viewer ended on, so closing it with Close or the system Back (`onRequestClose`) leaves the inline gallery on the same photo rather than the one that was tapped.

## `apps/mobile/src/components/service-pills/service-pills.tsx`

### `export function ServicePills`

Only `dealer.services` from the server is rendered (owner §7.5); there is no default list. Entries are trimmed and de-duplicated case-insensitively because dealers type them, and the section heading is not rendered when nothing is left.

## `apps/mobile/src/features/cars/car-detail-screen/car-detail-screen.tsx`

### View dealership

It now follows the dealership name, verification badge and the trust or check-the-documents sentence (owner §7.4), as a secondary button. Reading the guidance before the action is the order a buyer needs.

## `apps/mobile/src/features/dealers/dealer-profile-screen/dealer-profile-screen.tsx`

### Inventory scroll preservation

The jump to the top of the profile after a filter or sort change (owner §8.1) had two causes. The inventory query is keyed by its parameters, so a change started a new query with no data; the list emptied and its content shrank under the scroll position. And the Sort/Filters tools were rendered only while there were cars, so they unmounted mid-change.

The query now keeps the previous page as placeholder data while the new one loads, with an inline "Updating cars…" line instead of an empty list. The tools stay mounted whenever a filter or sort is set or the request failed. After an apply, sort or clear, the list scrolls to the measured inventory heading — deliberately, since the result set below may be shorter — rather than wherever the shrinking content left it.
