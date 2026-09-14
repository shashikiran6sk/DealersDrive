'use client';

import type { ConfigEntry } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Banner, Tag } from '@/components/ui/primitives';
import { updateConfigAction } from '@/features/admin/config-actions';

export function ConfigRow({ entry }: { entry: ConfigEntry }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [value, setValue] = useState(() => toInput(entry));

  const dirty = value !== toInput(entry);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateConfigAction(entry.key, entry.type, value);
      if (!result.ok) {
        setError(result.message ?? 'We could not save that setting.');
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  if (!entry.readBy) return <PlaceholderRow entry={entry} />;

  return (
    <div className="flex flex-col gap-2 border-b border-(--color-divider) px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="block text-[12px] ink-secondary" htmlFor={entry.key}>
            {entry.label}
          </label>
          <div className="font-mono text-[11px] ink-faint">{entry.key}</div>
        </div>

        {entry.type === 'boolean' ? (
          <Select
            id={entry.key}
            className="w-auto min-w-[120px]"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </Select>
        ) : entry.type === 'string[]' ? (
          <Textarea
            id={entry.key}
            className="min-w-[280px] flex-[2]"
            rows={4}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        ) : (
          <Input
            id={entry.key}
            type={entry.type === 'number' ? 'number' : 'text'}
            className={entry.type === 'number' ? 'w-auto min-w-[140px] tnum' : 'flex-[2]'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}

        <Button variant="secondary" loading={pending} disabled={!dirty} onClick={save}>
          Save
        </Button>
      </div>

      <p className="text-[11px] ink-faint">
        {entry.type === 'string[]' ? 'One entry per line. ' : ''}
        Read by {entry.readBy}.
      </p>
      {entry.updatedAt ? (
        <p className="text-[11px] ink-faint">Last changed {entry.updatedAt.slice(0, 10)}</p>
      ) : null}

      {error ? <Banner tone="err">{error}</Banner> : null}
      {saved && !dirty ? <Banner tone="ok">Saved.</Banner> : null}
    </div>
  );
}

function PlaceholderRow({ entry }: { entry: ConfigEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-(--color-divider) px-4 py-3 last:border-b-0">
      <div className="min-w-[220px] flex-1">
        <div className="text-[12px] ink-secondary">{entry.label}</div>
        <div className="font-mono text-[11px] ink-faint">{entry.key}</div>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] ink-muted tnum">{displayValue(entry)}</span>
        <Tag>Not in use yet</Tag>
      </div>
    </div>
  );
}

function toInput(entry: ConfigEntry): string {
  if (Array.isArray(entry.value)) return entry.value.join('\n');
  return String(entry.value);
}

function displayValue(entry: ConfigEntry): string {
  if (Array.isArray(entry.value)) {
    return entry.value.length === 1 ? '1 entry' : `${String(entry.value.length)} entries`;
  }
  if (typeof entry.value === 'boolean') return entry.value ? 'Enabled' : 'Disabled';
  return String(entry.value);
}
