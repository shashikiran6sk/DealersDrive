'use client';

import { cn } from '@/lib/cn';

import { HEART_EMPTY, HEART_FULL, SAVE_BUTTON_TEXT } from './save-button.constants';
import { useSavedVehicles } from './saved-vehicles-context';

export interface SaveButtonProps {
  slug: string;
  title: string;
  variant?: 'overlay' | 'labelled';
  className?: string;
}

export function SaveButton({ slug, title, variant = 'overlay', className }: SaveButtonProps) {
  const saved = useSavedVehicles();
  if (!saved.enabled) return null;

  const isSaved = saved.isSaved(slug);
  const pending = saved.isPending(slug);

  return (
    <button
      type="button"
      aria-pressed={isSaved}
      aria-label={isSaved ? SAVE_BUTTON_TEXT.unsave(title) : SAVE_BUTTON_TEXT.save(title)}
      title={isSaved ? SAVE_BUTTON_TEXT.unsaveShort : SAVE_BUTTON_TEXT.saveShort}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        saved.toggle(slug);
      }}
      className={cn(
        'relative z-[3] inline-flex items-center justify-center gap-[6px] border bg-white',
        'transition-colors duration-150 disabled:cursor-progress',
        isSaved
          ? 'border-(--color-accent) text-(--color-accent)'
          : 'border-(--color-divider) text-(--color-ink) hover:border-(--color-neutral-400)',
        variant === 'overlay'
          ? 'h-[36px] w-[36px] rounded-[10px] text-[18px] leading-none shadow-sm'
          : 'btn btn-secondary h-[40px] px-[14px] text-[14px]',
        className,
      )}
    >
      <span aria-hidden="true">{isSaved ? HEART_FULL : HEART_EMPTY}</span>
      {variant === 'labelled' ? (
        <span>{isSaved ? SAVE_BUTTON_TEXT.savedLabel : SAVE_BUTTON_TEXT.saveLabel}</span>
      ) : null}
    </button>
  );
}
