# web / features/dealer/inventory

Parent: [web](../../README.md)

## `apps/web/src/features/dealer/inventory/inventory-view.tsx`

### `export function InventoryView({ inventory, status, q }: InventoryViewProps)`

DESIGN-SPEC §3.13, rendered on the server with no client state: the status tabs,
the search box and "Show more" are all plain links and a `GET` form, so the
filter lives in the URL and a refresh or a shared link shows the same list.

Every tab shows its count from the API's `counts`, which ignore the filter — a
dealer on _Changes requested_ still sees how many are _Active_. A table on
desktop and a card list below 768px, both from the same rows; the moderator's
words on a vehicle sent back are shown on the row itself, because that is the
row the dealer has to act on.

Every row opens the vehicle's review screen. For a draft or a vehicle sent back
that screen has the Edit links and the Submit button; for anything else it is
the read-only view with its status — so there is one place a dealer looks at a
car, whatever state it is in.
