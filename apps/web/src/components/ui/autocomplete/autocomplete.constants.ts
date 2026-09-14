/**
 * How long to wait for typing to stop. Below ~150 ms the saving disappears on
 * anything but a hunt-and-peck typist; past ~400 the list visibly lags the
 * caret. A constant rather than a prop because a box that felt different from
 * the box on the next page would be a worse product than either setting.
 */
export const SUGGEST_DEBOUNCE_MS = 300;

/**
 * The shortest input worth asking about. A low bar deliberately — "MG" is a
 * marque and several dealerships trade under two letters.
 */
export const SUGGEST_MIN_CHARS = 1;

export const AUTOCOMPLETE_TEXT = {
  clearLabel: 'Clear the search',
  clearGlyph: '✕',
  escapeHint: 'ESC to close',
  loading: 'Searching…',
  error: 'Suggestions are unavailable just now. Your search still works.',
} as const;
