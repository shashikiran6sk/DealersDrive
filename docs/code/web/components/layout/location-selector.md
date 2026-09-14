# web / components/layout/location-selector

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/layout/location-selector/location-selector.tsx`

### `export function LocationSelector({ locations }: { locations: PublicLocations })`

DESIGN-SPEC §2.14 — the header's location button.

The dialog it opens, and the rule for what choosing a district means, are
`DistrictPicker`'s (**R23**) — the directory opens the same dialog from its
own button, and a second copy of the selection rule is how the two would come
to disagree. What is left here is the header's trigger and nothing else.

**"Select district", not "All districts" (R23).** The button used to read
`All districts` before a choice was made, which is a true description of what
is on screen and a poor description of what the button is _for_: it states a
filter setting where a first-time visitor needs an invitation. `All districts`
is now the dialog's footer button, where it is the way _back_ rather than the
resting state. Nothing about the unfiltered URL changed.
