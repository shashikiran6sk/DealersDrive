'use client';

import { GuideImage } from '@/components/vehicle/photo-standard';
import { cn } from '@/lib/cn';

import { PHOTO_STEP_TEXT } from './photo-step.constants';

export type ArrangementCellState = 'empty' | 'local' | 'uploaded';

export interface ArrangementCellProps {
  position: string;
  photoUrl: string | null;
  exampleUrl: string | null;
  state: ArrangementCellState;
  selected: boolean;
  moveTarget: boolean;
  failed: boolean;
  disabled: boolean;
  onPress: () => void;
  onRemove?: () => void;
}

export function ArrangementCell({
  position,
  photoUrl,
  exampleUrl,
  state,
  selected,
  moveTarget,
  failed,
  disabled,
  onPress,
  onRemove,
}: ArrangementCellProps) {
  const pressable = !disabled && state !== 'uploaded' && (state === 'local' || moveTarget);
  return (
    <div className="flex flex-col gap-[6px]">
      <div
        className={cn(
          'relative aspect-[4/3] overflow-hidden rounded-[10px] border-2',
          selected
            ? 'border-(--color-focus)'
            : failed
              ? 'border-(--color-err)'
              : state === 'uploaded'
                ? 'border-(--color-ok)'
                : state === 'empty'
                  ? 'border-dashed border-(--color-accent-400)'
                  : 'border-transparent',
        )}
      >
        <button
          type="button"
          disabled={!pressable}
          aria-pressed={state === 'local' ? selected : undefined}
          aria-label={
            moveTarget && !selected
              ? PHOTO_STEP_TEXT.cellMoveHere(position)
              : PHOTO_STEP_TEXT.cellSelect(position)
          }
          onClick={onPress}
          className="absolute inset-0 h-full w-full bg-(--color-accent-100) enabled:cursor-pointer"
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : exampleUrl ? (
            <GuideImage
              src={exampleUrl}
              alt=""
              className="h-full rounded-none object-cover opacity-35"
            />
          ) : null}
          {state === 'empty' ? (
            <span className="absolute inset-x-0 bottom-[6px] text-center text-[11px] font-medium ink-muted">
              {PHOTO_STEP_TEXT.cellEmpty}
            </span>
          ) : null}
        </button>
        {photoUrl && exampleUrl ? (
          <GuideImage
            src={exampleUrl}
            alt=""
            className="pointer-events-none absolute right-[5px] bottom-[5px] w-[30%] rounded-[6px] border-2 border-white shadow-sm"
          />
        ) : null}
        {state === 'uploaded' ? (
          <span className="pointer-events-none absolute top-[5px] left-[5px] rounded-full bg-(--color-ok) px-[7px] py-[1px] text-[10px] font-bold text-white">
            ✓ {PHOTO_STEP_TEXT.cellUploaded}
          </span>
        ) : failed ? (
          <span className="pointer-events-none absolute top-[5px] left-[5px] rounded-full bg-(--color-err) px-[7px] py-[1px] text-[10px] font-bold text-white">
            {PHOTO_STEP_TEXT.cellFailed}
          </span>
        ) : null}
        {state === 'local' && onRemove && !disabled ? (
          <button
            type="button"
            aria-label={PHOTO_STEP_TEXT.cellRemove(position)}
            onClick={onRemove}
            className="absolute top-[5px] right-[5px] inline-flex h-[24px] w-[24px] items-center justify-center rounded-full bg-black/60 text-[14px] leading-none text-white"
          >
            ×
          </button>
        ) : null}
      </div>
      <p className="text-[12px] leading-tight font-medium">{position}</p>
    </div>
  );
}
