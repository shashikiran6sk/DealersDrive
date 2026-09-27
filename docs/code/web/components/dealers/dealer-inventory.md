# web / components/dealers/dealer-inventory

Parent: [web/components/dealers](README.md)

## `apps/web/src/components/dealers/dealer-inventory/dealer-inventory.tsx`

### `export function DealerInventory({ dealerSlug, brandName, inventory }: DealerInventoryProps)`

The portfolio's inventory (**R48**, DESIGN-SPEC §3.6). It renders the same
`VehicleCard` as `/cars` in its `compact` variant, which is §2.8's portfolio
card: the dealer strip is left off because on the dealer's own page it only
repeats the header above it. Nothing else about the card changes, and there is
no second card component.

It computes nothing: the cards, the total and the paging arrive from the API.
An empty inventory is a plain statement — "No vehicles currently available." —
with a way to the rest of the marketplace, never a count that cannot be
clicked through.
