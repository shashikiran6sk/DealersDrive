import type { ConfigEntry } from '@dealers-drive/contracts';

import { Tag } from '@/components/ui/primitives';

import { CONFIG_EDITOR_TEXT } from './config-editor.constants';
import { displayValue } from './utils';

/**
 * A key nothing reads yet. The value is shown, because "what will this be when
 * the feature lands" is a real question, and the control is not, because
 * changing it would change nothing and say otherwise.
 */
export function PlaceholderRow({ entry }: { entry: ConfigEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-(--color-divider) px-4 py-3 last:border-b-0">
      <div className="min-w-[220px] flex-1">
        <div className="text-[12px] ink-secondary">{entry.label}</div>
        <div className="font-mono text-[11px] ink-faint">{entry.key}</div>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] ink-muted tnum">{displayValue(entry)}</span>
        <Tag>{CONFIG_EDITOR_TEXT.notInUse}</Tag>
      </div>
    </div>
  );
}
