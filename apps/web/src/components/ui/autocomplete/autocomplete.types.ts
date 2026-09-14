import type { KeyboardEvent } from 'react';

export interface SuggestPayload<T> {
  search: string;
  data: T[];
  countLabel: string;
}

export interface AutocompleteSource<T> {
  suggest: (search: string, signal: AbortSignal) => Promise<SuggestPayload<T>>;
  keyOf: (item: T) => string;
  valueOf: (item: T) => string;
}

export type AutocompleteStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AutocompleteResult<T> {
  status: AutocompleteStatus;
  items: T[];
  countLabel: string;
  search: string;
}

export interface UseAutocomplete<T> {
  value: string;
  setValue: (next: string) => void;
  clear: () => void;
  open: boolean;
  close: () => void;
  status: AutocompleteStatus;
  items: T[];
  countLabel: string;
  search: string;
  highlighted: number;
  setHighlighted: (index: number) => void;
  choose: (item: T) => void;
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
  listProps: { id: string; role: 'listbox' };
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
  onSelect: (item: T) => void;
  onClear?: () => void;
}
