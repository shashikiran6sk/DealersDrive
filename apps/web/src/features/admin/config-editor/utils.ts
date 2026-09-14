import type { ConfigEntry } from '@dealers-drive/contracts';

import { CONFIG_EDITOR_TEXT } from './config-editor.constants';

/** The stored value as the control holds it — a list is one entry per line. */
export function toInput(entry: ConfigEntry): string {
  if (Array.isArray(entry.value)) return entry.value.join('\n');
  return String(entry.value);
}

/** The stored value as one line — a list becomes "3 entries" rather than a wall. */
export function displayValue(entry: ConfigEntry): string {
  if (Array.isArray(entry.value)) {
    return entry.value.length === 1 ? '1 entry' : `${String(entry.value.length)} entries`;
  }
  if (typeof entry.value === 'boolean') {
    return entry.value ? CONFIG_EDITOR_TEXT.enabled : CONFIG_EDITOR_TEXT.disabled;
  }
  return String(entry.value);
}
