import { PHOTO_STANDARD_TEXT } from './photo-standard.constants';
import type { ShotGuide } from './photo-standard.types';

export function ShotInstructions({ shot }: { shot: ShotGuide }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h5 className="text-[11px] font-semibold tracking-[0.08em] uppercase ink-muted">
          {PHOTO_STANDARD_TEXT.stepsTitle}
        </h5>
        <ol className="flex flex-col gap-[6px] text-[13px]">
          {shot.steps.map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="mt-[1px] inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-(--color-ink) text-[11px] font-bold text-white">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-[10px] border border-(--color-divider) p-[10px]">
          <h5 className="mb-1 text-[11px] font-semibold tracking-[0.08em] uppercase ink-muted">
            {PHOTO_STANDARD_TEXT.checksTitle}
          </h5>
          <ul className="flex flex-col gap-[4px] text-[13px]">
            {shot.checks.map((check) => (
              <li key={check} className="flex gap-2">
                <span aria-hidden className="text-(--color-ok)">
                  ✓
                </span>
                {check}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[10px] border border-[color-mix(in_srgb,var(--color-err)_25%,transparent)] bg-(--color-err-bg) p-[10px]">
          <h5 className="mb-1 text-[11px] font-semibold tracking-[0.08em] uppercase text-(--color-err)">
            {PHOTO_STANDARD_TEXT.avoidTitle}
          </h5>
          <p className="text-[13px]">{shot.avoid}</p>
        </div>
      </div>
    </div>
  );
}
