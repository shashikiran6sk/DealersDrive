'use client';

import type { ConfigEntry } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { updateConfigAction } from '@/features/admin/config-actions';

/** D14 — one row, one value, one save. */
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
          <select
            id={entry.key}
            className="input w-auto min-w-[120px]"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        ) : entry.type === 'string[]' ? (
          <textarea
            id={entry.key}
            className="input min-w-[280px] flex-[2]"
            rows={4}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        ) : (
          <input
            id={entry.key}
            type={entry.type === 'number' ? 'number' : 'text'}
            className={
              entry.type === 'number' ? 'input w-auto min-w-[140px] tnum' : 'input flex-[2]'
            }
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}

        <Button variant="secondary" loading={pending} disabled={!dirty} onClick={save}>
          Save
        </Button>
      </div>

      {entry.type === 'string[]' ? (
        <p className="text-[11px] ink-faint">One entry per line.</p>
      ) : null}
      {entry.updatedAt ? (
        <p className="text-[11px] ink-faint">Last changed {entry.updatedAt.slice(0, 10)}</p>
      ) : null}

      {error ? <Banner tone="err">{error}</Banner> : null}
      {saved && !dirty ? <Banner tone="ok">Saved.</Banner> : null}
    </div>
  );
}

function toInput(entry: ConfigEntry): string {
  if (Array.isArray(entry.value)) return entry.value.join('\n');
  return String(entry.value);
}
