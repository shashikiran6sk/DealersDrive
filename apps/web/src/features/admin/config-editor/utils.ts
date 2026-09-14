import type { ConfigEntry } from '@dealers-drive/contracts';

import { CONFIG_EDITOR_TEXT } from './config-editor.constants';

export function toInput(entry: ConfigEntry): string {
  if (Array.isArray(entry.value)) return entry.value.join('\n');
  return String(entry.value);
}

export function displayValue(entry: ConfigEntry): string {
  if (Array.isArray(entry.value)) {
    return entry.value.length === 1 ? '1 entry' : `${String(entry.value.length)} entries`;
  }
  if (typeof entry.value === 'boolean') {
    return entry.value ? CONFIG_EDITOR_TEXT.enabled : CONFIG_EDITOR_TEXT.disabled;
  }
  return String(entry.value);
}
