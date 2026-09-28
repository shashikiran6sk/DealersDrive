# web / features/dealer/listing-lifecycle

Parent: [web](../../README.md)

The dealer's controls for a car once it has been live (**R70**, the console
half of F067 as **R69** redefines it): Reserve, Make active, Mark sold,
Withdraw and Relist.

## `apps/web/src/features/dealer/listing-lifecycle/listing-lifecycle-actions.tsx`

### `export function ListingLifecycleActions(props)`

It renders exactly the moves in `listing.actions`, which the API computes from
the same table its state machine enforces. The console never works out for
itself which moves a status allows, so it cannot offer one the server would
refuse, and a sold car shows nothing because the server lists nothing.

The Server Action is imported by its full `@/…/actions` path, not through the
barrel, so the sandbox can alias that one module to a stub (coupling C-4). The
same reasoning applies to `@/features/dealer/enquiry-actions`.

## `apps/web/src/features/dealer/listing-lifecycle/lifecycle-dialog.tsx`

### `export function LifecycleDialog(props)`

Every move changes what buyers see, so every move is confirmed, with the
sentence in `LIFECYCLE_MOVES`. Mark sold says it is final, because R69 gives no
way back from `SOLD`. Withdraw is the one destructive-toned move, and its
confirm button stays disabled until a reason is chosen. The action refuses a
reason it cannot parse before calling anything, and the API refuses one too.
A refusal keeps the dialog open with the API's own sentence. A success closes
it, and the page redraws from the revalidation.

## `apps/web/src/features/dealer/listing-lifecycle/actions.ts`

### `export async function listingLifecycleAction(vehicleId, action, withdrawal?)`

One route per move (`LIFECYCLE_PATHS`), with a body only for a withdrawal. On
success it redraws everything the move can change:

- the inventory, the dashboard counts and the vehicle's own page
- the public vehicle lists (`VEHICLES_TAG`, which `/cars` and the portfolio
  read)
- the directory's counts (`DEALERS_TAG`)
- the car's own page, by its slug

Without that last one, a car marked sold would keep a cached public page until
the tag expired.

## `apps/web/src/features/dealer/listing-lifecycle/listing-lifecycle-panel.tsx`

### `export function ListingLifecyclePanel(props)`

The foot of a live vehicle's page in the console. It shows the moves, a
withdrawn listing's reason and note (the dealership's own record, which no
public page shows), and **View on site** while the car is `ACTIVE`.
