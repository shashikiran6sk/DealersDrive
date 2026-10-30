# Canonical vehicle makes · new PR

PR: [#300](https://github.com/shashikiran6sk/DealersDrive/pull/300) · branch
`feat/canonical-vehicle-makes` · base `main` `6f4f040` · first head `92ac922`, final head `383a2b0`.

## Audit before the change (`main` `6f4f040`)

- Make was free text everywhere: `vehicles.make` TEXT with no CHECK and no
  catalogue tables (removed by D1).
- Write-time normalisation only collapsed whitespace and adopted the oldest
  stored spelling, compared case-insensitively. Abbreviations and corporate
  names were not handled.
- Search keyed brands by `slugify(make)`, so `Maruti` and `Maruti Suzuki` were
  separate facets and filters.
- `platform/rc/rc-aliases.ts`, which the docs refer to, does not exist on
  `main`, because F057/F058 are deferred. There was no list to reuse.
- The dev seed uses 12 canonical brand spellings. Every test fixture make
  except deliberate negative cases is canonical.

## What changed

See the PR description and `docs/project/canonical-vehicle-makes.md`.
In short:

- One contract list of 42 makes, plus an exact-match alias table.
- `422 VEHICLE_MAKE_UNKNOWN` for any other new make.
- A legacy stored make is accepted when sent back unchanged.
- Search folds legacy spellings at read time.
- The wizard uses a searchable combobox.
- No migration, no backfill.

## Self-review against the brief

| Gap                                                                        | Fix (`383a2b0`)                                                                        |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `maruthisuzuki` and other space-free spellings did not resolve             | Keys are compared with spaces removed too; a test proves no compacted key is ambiguous |
| The common `Maruthi` transliteration was missing                           | Reviewed alias of Maruti Suzuki                                                        |
| Web search was not whitespace or punctuation tolerant (`marutisuz`)        | `matchMakes` compares compacted forms                                                  |
| A legacy make was checked only against the row read before the transaction | Re-checked against the row read under the listing lock; unit tests cover the race      |

## Executed checks (Node 24.21.0, PostgreSQL 16.15)

| Check                                                | Result                                                                                                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lint + typecheck                                     | PASS on `383a2b0`                                                                                                                                                                                           |
| tests on `383a2b0`                                   | contracts 522 · web 1,552 · API 3,307 (`logs/test-summary.txt`)                                                                                                                                             |
| build                                                | PASS on `383a2b0`                                                                                                                                                                                           |
| Wizard E2E, 390 and 1,280 px (`wizard-results.json`) | "merc" → `Mercedes-Benz` only. "tata motors" + Tab shows and stores `Tata`. Legacy `Hindustan Ambassador Co` is shown and offered first as "(as saved)", then kept on re-save. No overflow, no page errors. |
| Search folding (`search-folding.json`)               | With two rows set to `MARUTI SUZUKI INDIA LTD` and `Maruti`, there is still one `maruti-suzuki` facet with the same count, and the brand filter returns the same totals as the text search.                 |
| Sandbox (`sandbox-results.json`)                     | All six `Forms/VehicleMakeSelect` stories render without errors; checked by eye.                                                                                                                            |

All data is the synthetic local seed.

## CI

See `ci.md`.

The wizard E2E and the sandbox were run on `92ac922`. `383a2b0` changes no UI path except `matchMakes`, which has its own unit tests.
