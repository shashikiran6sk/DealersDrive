'use client';

import { cn } from '@/lib/cn';

import { PHOTO_STEP_TEXT } from './photo-step.constants';
import type { UploadMode } from './photo-step.types';

export interface UploadModeSwitchProps {
  mode: UploadMode;
  disabled?: boolean;
  onChange: (mode: UploadMode) => void;
}

const MODES: readonly { mode: UploadMode; label: string; hint: string }[] = [
  { mode: 'all', label: PHOTO_STEP_TEXT.modeAll, hint: PHOTO_STEP_TEXT.modeAllHint },
  { mode: 'one', label: PHOTO_STEP_TEXT.modeOne, hint: PHOTO_STEP_TEXT.modeOneHint },
];

export function UploadModeSwitch({ mode, disabled = false, onChange }: UploadModeSwitchProps) {
  return (
    <div
      role="radiogroup"
      aria-label={PHOTO_STEP_TEXT.modeLabel}
      className="grid grid-cols-2 gap-[6px] rounded-[12px] bg-(--color-accent-100) p-[4px]"
    >
      {MODES.map((option) => {
        const selected = option.mode === mode;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.mode)}
            className={cn(
              'flex flex-col items-start rounded-[9px] px-[12px] py-[8px] text-left transition-colors disabled:opacity-60',
              selected ? 'bg-white shadow-sm ring-2 ring-(--color-ink)' : 'hover:bg-white/60',
            )}
          >
            <span className="text-[14px] font-semibold">{option.label}</span>
            <span className="text-[12px] ink-muted">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
