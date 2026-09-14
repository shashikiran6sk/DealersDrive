import type { KeyboardEvent } from 'react';

/** What a suggest endpoint answers with. One shape for every typeahead. */
export interface SuggestPayload<T> {
  /**
   * The search this payload answers. **Load-bearing** — a source that does not
   * echo it back cannot have its stale answers guarded against on the client.
   */
  search: string;
  data: T[];
  countLabel: string;
}

/** Everything the interaction needs to know about the rows it is moving through. */
export interface AutocompleteSource<T> {
  /**
   * Fetch suggestions for `search`. Must honour `signal`, and must echo the
   * search back in the payload.
   */
  suggest: (search: string, signal: AbortSignal) => Promise<SuggestPayload<T>>;
  /** A stable React key, and the suffix of the option's DOM id. */
  keyOf: (item: T) => string;
  /** What the input should read once this row is chosen. */
  valueOf: (item: T) => string;
}

/** Where the dropdown is in its lifecycle. Rendered, not inferred from truthiness. */
export type AutocompleteStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AutocompleteResult<T> {
  status: AutocompleteStatus;
  items: T[];
  countLabel: string;
  /** The search these items answer — what the highlighter marks. */
  search: string;
}

export interface UseAutocomplete<T> {
  value: string;
  setValue: (next: string) => void;
  /** Clears the box and closes the list, without choosing anything. */
  clear: () => void;
  open: boolean;
  close: () => void;
  status: AutocompleteStatus;
  items: T[];
  countLabel: string;
  /** The characters the rows matched — pass to `HighlightedText`. */
  search: string;
  /** Index into `items`. Always 0 after a fresh answer; -1 when there are none. */
  highlighted: number;
  setHighlighted: (index: number) => void;
  /** Chooses a row: fills the input, closes the list, calls `onSelect`. */
  choose: (item: T) => void;
  /** Spread onto the `<input>`. Carries the combobox ARIA and the key handling. */
  inputProps: {
    value: string;
    role: 'combobox';
    autoComplete: 'off';
    spellCheck: false;
    'aria-autocomplete': 'list';
    'aria-expanded': boolean;
    'aria-controls': string;
    'aria-activedescendant': string | undefined;
    onChange: (event: { target: { value: string } }) => void;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    onFocus: () => void;
  };
  /** Spread onto the listbox element. */
  listProps: { id: string; role: 'listbox' };
  /** Spread onto each row. `index` is its position in `items`. */
  optionProps: (
    item: T,
    index: number,
  ) => {
    id: string;
    role: 'option';
    'aria-selected': boolean;
    onMouseEnter: () => void;
    onMouseDown: (event: { preventDefault: () => void }) => void;
    onClick: () => void;
  };
}

export interface UseAutocompleteOptions<T> {
  source: AutocompleteSource<T>;
  initialValue?: string;
  /** A row was chosen — by Enter, or by a click. */
  onSelect: (item: T) => void;
  /** The box was emptied. Separate from `onSelect` because it is the opposite. */
  onClear?: () => void;
}
