import { GuideImage, SHOT_GUIDES, shotImage } from '@/components/vehicle/photo-standard';
import { cn } from '@/lib/cn';

import { PHOTO_STEP_TEXT } from './photo-step.constants';

export function ShotProgress({ done }: { done: ReadonlySet<string> }) {
  return (
    <ol className="grid grid-cols-5 gap-[6px] sm:grid-cols-10">
      {SHOT_GUIDES.map((shot) => {
        const complete = done.has(shot.slot);
        return (
          <li key={shot.slot}>
            <a
              href={`#upload-shot-${String(shot.number)}`}
              aria-label={PHOTO_STEP_TEXT.jumpTo(shot.number, shot.title)}
              className={cn(
                'relative block overflow-hidden rounded-[8px] border-2',
                complete ? 'border-(--color-ok)' : 'border-transparent',
              )}
            >
              <GuideImage
                src={shotImage(shot.number, 'result')}
                alt=""
                className={cn(
                  'aspect-[4/3] rounded-none object-cover',
                  complete ? '' : 'opacity-60',
                )}
              />
              <span
                aria-hidden
                className={cn(
                  'absolute top-[3px] left-[3px] inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[4px] text-[10px] font-bold text-white',
                  complete ? 'bg-(--color-ok)' : 'bg-(--color-ink)',
                )}
              >
                {complete ? '✓' : shot.number}
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
