# web / components/ui/autocomplete

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/ui/autocomplete/autocomplete-panel.tsx`

### `label: string`

The visually-hidden `<label>`. Never a placeholder standing in for one.

### `groupLabel: string`

The uppercase heading over the rows — "Dealerships in Vellore district".

### `emptyMessage: (search: string) => string`

What to say when the search matched nothing. Gets the search back.

### `export function AutocompletePanel<T>(`

The shell every typeahead draws: the bordered input row, and the panel under
it (DESIGN-SPEC §3.5).

It renders the four states a remote list actually has — loading, error,
nothing found, and rows — because each is a different sentence and collapsing
any two of them lies to somebody. The rows themselves are the caller's, so a
dealer row and a vehicle row can look entirely different while the panel, the
states and the keyboard stay one implementation.

### `useEffect(() =>`

A click anywhere else closes the panel. `pointerdown` rather than `click` so
the panel is gone before the thing underneath reacts, and on the document
rather than via a blur handler because focus never leaves the input.

### `onClick={autocomplete.clear}`

A convenience for a pointer; Escape plus select-all is the

### `onClick={autocomplete.clear}`

keyboard's way to the same place.

### `<div {...autocomplete.listProps} className="px-[12px] py-[14px] text-[13px]">`

One row, saying which of the three non-list states this is. It still
carries the listbox role: a screen reader that was told the box
controls a list should not find that the list has vanished.

## `apps/web/src/components/ui/autocomplete/autocomplete.constants.ts`

### `export const SUGGEST_DEBOUNCE_MS = 300`

How long to wait for typing to stop. Below ~150 ms the saving disappears on
anything but a hunt-and-peck typist; past ~400 the list visibly lags the
caret. A constant rather than a prop because a box that felt different from
the box on the next page would be a worse product than either setting.

### `export const SUGGEST_MIN_CHARS = 1`

The shortest input worth asking about. A low bar deliberately — "MG" is a
marque and several dealerships trade under two letters.

## `apps/web/src/components/ui/autocomplete/autocomplete.types.ts`

### `export interface SuggestPayload<T>`

What a suggest endpoint answers with. One shape for every typeahead.

### `search: string`

The search this payload answers. **Load-bearing** — a source that does not
echo it back cannot have its stale answers guarded against on the client.

### `export interface AutocompleteSource<T>`

Everything the interaction needs to know about the rows it is moving through.

### `suggest: (search: string, signal: AbortSignal) => Promise<SuggestPayload<T>>`

Fetch suggestions for `search`. Must honour `signal`, and must echo the
search back in the payload.

### `keyOf: (item: T) => string`

A stable React key, and the suffix of the option's DOM id.

### `valueOf: (item: T) => string`

What the input should read once this row is chosen.

### `export type AutocompleteStatus = 'idle' | 'loading' | 'ready' | 'error'`

Where the dropdown is in its lifecycle. Rendered, not inferred from truthiness.

### `search: string`

The search these items answer — what the highlighter marks.

### `clear: () => void`

Clears the box and closes the list, without choosing anything.

### `search: string`

The characters the rows matched — pass to `HighlightedText`.

### `highlighted: number`

Index into `items`. Always 0 after a fresh answer; -1 when there are none.

### `choose: (item: T) => void`

Chooses a row: fills the input, closes the list, calls `onSelect`.

### `inputProps:`

Spread onto the `<input>`. Carries the combobox ARIA and the key handling.

### `listProps: { id: string; role: 'listbox' }`

Spread onto the listbox element.

### `optionProps:`

Spread onto each row. `index` is its position in `items`.

### `onSelect: (item: T) => void`

A row was chosen — by Enter, or by a click.

### `onClear?: () => void`

The box was emptied. Separate from `onSelect` because it is the opposite.

## `apps/web/src/components/ui/autocomplete/highlighted-text.tsx`

### `export function HighlightedText({ text, match }: { text: string; match: string }): ReactNode`

The typed characters, marked inside a label (**R43**). Case-insensitive, and
it marks _every_ occurrence: underlining one `a` in "Vellore Star Auto" and
leaving the others plain reads as a rendering fault rather than a match.

`<mark>` rather than a styled `<span>` because that is what the element is
for, and because a screen reader announces it. Text that does not contain the
search renders unmarked — the correct answer for a row matched on its town.

## `apps/web/src/components/ui/autocomplete/use-autocomplete.ts`

### `export function useAutocomplete<T>(`

The typeahead interaction, with nothing dealer-shaped in it (**R43**). A
caller supplies a `suggest` function and a row renderer; the hook owns the
three things that make a typeahead correct:

· **Debounce** — one request for "vellore" rather than eight.
· **Abort** — the request a new query replaced is cancelled, on unmount too.
· **The stale guard** — the one usually missing. Abort does not help once
bytes are on the wire: a two-character query against a cold cache can
resolve _after_ the four-character query that replaced it. Every response
carries the search it answered, and a mismatch is dropped.

Accessibility is the ARIA 1.2 combobox pattern by hand — Radix has no
combobox. The input keeps focus throughout and `aria-activedescendant` moves
the screen reader's cursor, so a buyer can arrow the list while still typing.

### `const chosen = useRef<string | null>(null)`

The value this box wrote into itself by choosing a row — otherwise choosing
"Vellore Cars" debounces into a request for the name just chosen and
reopens the dropdown over a page that is already navigating. A ref because
nothing renders from it and it must be true before the effect runs.

### `const sourceRef = useRef(source)`

`source` is almost always an object literal, so it is a new reference every
render and cannot go in the dependency list without refetching on each one.

### `if (payload.search.trim() !== debounced) return`

The stale guard: a reply to anything but the question currently being

### `if (payload.search.trim() !== debounced) return`

asked is dropped rather than rendered.

### `setHighlighted(0)`

A fresh answer always highlights its first row: the whole promise of

### `setHighlighted(0)`

this control is that Enter does the obvious thing without arrowing.

### `if (controller.signal.aborted) return`

An abort is this hook cancelling itself, not a failure. Showing

### `if (controller.signal.aborted) return`

"something went wrong" because a buyer typed another character would

### `if (controller.signal.aborted) return`

make fast typing look broken.

### `const activeIndex = items.length === 0 ? -1 : Math.min(highlighted, items.length - 1)`

-1 rather than 0 when the list is empty, so `items[highlighted]` is

### `const activeIndex = items.length === 0 ? -1 : Math.min(highlighted, items.length - 1)`

undefined rather than accidentally meaningful.

### `setHighlighted((current) => (current + delta + items.length) % items.length)`

Wraps, as the UI reference does: past the last row is the first one.

### `if (open && activeItem !== undefined)`

Enter uses whatever is highlighted, which after every fresh answer is

### `if (open && activeItem !== undefined)`

the first row — so the common case is: type, pause, Enter.

### `if (open)`

"Stop showing me this", not "undo what I wrote".

### `setOpen(false)`

Leaving the box abandons the suggestion. Choosing on blur is the

### `setOpen(false)`

behaviour that makes people distrust these controls.

### `onMouseDown: (event) => event.preventDefault()`

The click has to survive the blur. `mousedown` fires first and would
take focus off the input, and a blur handler that closes the list would
unmount the row before `click` ever reached it.
