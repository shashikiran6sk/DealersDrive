'use client';

import { cn } from '@/lib/cn';

import { FILTER_PANEL_TEXT } from './filter-panel.constants';

export interface FacetRowProps {
  type: 'checkbox' | 'radio';
  name: string;
  id: string;
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}

export function FacetRow({ type, name, id, label, count, checked, onChange }: FacetRowProps) {
  const empty = count === 0 && !checked;

  return (
    <li>
      <label
        htmlFor={id}
        className={cn(
          'flex min-h-[24px] cursor-pointer items-center gap-[9px] text-[13px]',
          empty && 'opacity-40',
        )}
      >
        <input
          id={id}
          type={type}
          name={name}
          className="h-[15px] w-[15px] flex-none accent-(--color-accent)"
          checked={checked}
          onChange={onChange}
          aria-label={count === undefined ? label : FILTER_PANEL_TEXT.named(label, count)}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {count === undefined ? null : (
          <span className="text-[11px] ink-faint tnum" aria-hidden="true">
            {count}
          </span>
        )}
      </label>
    </li>
  );
}
