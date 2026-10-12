# Canonical vehicle makes

A vehicle's make is chosen from one list of manufacturers, `VEHICLE_MAKES` in
`packages/contracts/src/vehicle-makes.ts`. The vehicle wizard offers it as a
searchable combobox (`VehicleMakeSelect`), and the API accepts nothing else for
a new value. Model and variant stay free text. A new model has to be enterable
the day it launches; a new manufacturer is rare enough to be a one-line change
to the list.

## Why

Decision D1 removed the seeded catalogue and named its cost: without one, make
becomes free text, and `Maruti`, `Maruti Suzuki` and `MARUTI SUZUKI INDIA LTD`
become three brand facets, three filter values and three entries in the car
search. Adopting the oldest stored spelling (F060) fixed case differences but
not abbreviations or corporate names. A closed list fixes all of these at the
point of entry.

## Rules

- **Resolution.** `canonicalVehicleMake` resolves a string in four steps:
  accents are folded, `&` is read as `AND`, punctuation is removed, and
  trailing corporate words (`India`, `Pvt`, `Ltd`, …) are dropped. The result
  is then matched exactly against the canonical names and a reviewed alias
  table. There is no fuzzy or prefix matching. A maker string that names two
  brands, such as `SKODA AUTO VOLKSWAGEN INDIA` or `JAGUAR LAND ROVER`, is
  deliberately not an alias.
- **Contract.** `UpdateVehicleInput.make` arrives canonical whenever the input
  resolves, so dealer, sales-assisted and API clients all store the brand's own
  spelling.
- **Validation.** Any other non-null make is `422 VEHICLE_MAKE_UNKNOWN`, naming
  the `make` field. The check runs after the ownership lookup, so a foreign
  vehicle id is still a 404.
- **Legacy values.** A vehicle saved before the list keeps its make when the
  same value is sent back. The combobox offers it as "(as saved)", so re-saving
  a step never forces a change to a field the dealer did not touch. Choosing a
  canonical make replaces it, and the old value cannot then be re-entered.

## Existing data

Nothing is backfilled and no migration is needed. Stored rows keep exactly
what they hold. Search folds them at read time instead: the brand facet, the
brand filter, the model facet's parent brand and the car suggestions all key a
stored make by `vehicleMakeSlug`, its canonical brand's slug when it resolves to
one. A car stored as `Maruti` is found under Maruti Suzuki and labelled that
way. An unresolvable legacy spelling stays its own facet value, exactly as
before.

Before rollout, an operator can run this read-only query to count legacy makes
by spelling:

```sql
SELECT make, count(*) FROM vehicles WHERE make IS NOT NULL GROUP BY make ORDER BY 2 DESC;
```

Spellings that resolve to a brand need no action. Any other spelling either
earns a reviewed alias (a one-line contract change) or is corrected by its
dealer through the wizard.

## Limits

- Similar-car matching still compares stored makes case-insensitively, so a
  legacy `Maruti` car is not "similar" to a `Maruti Suzuki` one until it is
  re-saved.
- The dealer inventory text search matches the stored text.
- RC lookup (F057/F058) remains deferred. When it lands, its maker string goes
  through the same `canonicalVehicleMake`.
