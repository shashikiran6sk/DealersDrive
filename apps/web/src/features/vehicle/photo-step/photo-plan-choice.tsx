'use client';

import type { PhotoPlan } from '@dealers-drive/contracts';

import { StatusTag } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { PHOTO_STEP_TEXT } from './photo-step.constants';
import type { PlanOption } from './photo-step.types';

export interface PhotoPlanChoiceProps {
  options: readonly PlanOption[];
  selected: PhotoPlan | null;
  disabled?: boolean;
  onChoose: (plan: PhotoPlan) => void;
}

export function PhotoPlanChoice({
  options,
  selected,
  disabled = false,
  onChoose,
}: PhotoPlanChoiceProps) {
  return (
    <div role="radiogroup" className="grid gap-[12px] md:grid-cols-2">
      {options.map((option) => {
        const active = selected === option.plan;
        const blocked = disabled || !option.available;
        return (
          <button
            key={option.plan}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={blocked}
            onClick={() => onChoose(option.plan)}
            className={cn(
              'flex flex-col items-start gap-[8px] rounded-[14px] border-2 bg-white p-[16px] text-left transition-colors',
              active
                ? 'border-(--color-ink) shadow-[0_0_0_3px_var(--color-accent-200)]'
                : 'border-(--color-divider) hover:border-(--color-accent-500)',
              blocked && !active
                ? 'cursor-not-allowed opacity-60 hover:border-(--color-divider)'
                : '',
            )}
          >
            <span className="flex w-full flex-wrap items-center justify-between gap-2">
              <span className="text-[16px] font-semibold">{option.title}</span>
              {active ? <StatusTag tone="ok">{PHOTO_STEP_TEXT.chosen}</StatusTag> : null}
            </span>
            <span className="text-[13px] ink-body">{option.body}</span>
            <span className="mt-auto flex flex-wrap items-center gap-2 pt-1">
              {option.note ? (
                <StatusTag tone={option.available ? 'neutral' : 'warn'}>{option.note}</StatusTag>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
