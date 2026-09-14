'use client';

import type { ConfigEntry } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { updateConfigAction } from '@/features/admin/config-actions';

import { BOOLEAN_VALUE, CONFIG_EDITOR_TEXT } from './config-editor.constants';
import { PlaceholderRow } from './placeholder-row';
import { toInput } from './utils';

/**
 * D14 — one row, one value, one save.
 *
 * The row renders a control when the API says something reads the key, and a
 * **placeholder** when nothing does. A placeholder is deliberately not an
 * editable field that quietly does nothing: an operator who sets "minimum
 * photos" to 8 and watches it save has been told the platform now requires eight
 * photos, and nothing on this screen would ever contradict them.
 *
 * `readBy` comes from the API rather than a list in this file, because the
 * question it answers — *does any running code consult this key* — is a fact
 * about the server.
 */
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
        setError(result.message ?? CONFIG_EDITOR_TEXT.saveFailed);
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
            <option value={BOOLEAN_VALUE.true}>{CONFIG_EDITOR_TEXT.enabled}</option>
            <option value={BOOLEAN_VALUE.false}>{CONFIG_EDITOR_TEXT.disabled}</option>
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
          {CONFIG_EDITOR_TEXT.save}
        </Button>
      </div>

      <p className="text-[11px] ink-faint">
        {entry.type === 'string[]' ? CONFIG_EDITOR_TEXT.oneEntryPerLine : ''}
        {CONFIG_EDITOR_TEXT.readBy(entry.readBy)}
      </p>
      {entry.updatedAt ? (
        <p className="text-[11px] ink-faint">
          {CONFIG_EDITOR_TEXT.lastChanged(entry.updatedAt.slice(0, 10))}
        </p>
      ) : null}

      {error ? <Banner tone="err">{error}</Banner> : null}
      {saved && !dirty ? <Banner tone="ok">{CONFIG_EDITOR_TEXT.saved}</Banner> : null}
    </div>
  );
}
