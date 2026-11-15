import { GuideImage } from './guide-image';
import { PHOTO_STANDARD_TEXT } from './photo-standard.constants';
import type { ShotGuide } from './photo-standard.types';
import { shotImage } from './utils';

export interface ShotIllustrationProps {
  shot: ShotGuide;
  compact?: boolean;
}

export function ShotIllustration({ shot, compact = false }: ShotIllustrationProps) {
  return (
    <div className="flex flex-col gap-2">
      <figure className="relative m-0">
        <GuideImage
          src={shotImage(shot.number, 'position')}
          alt={PHOTO_STANDARD_TEXT.positionAlt(shot.title)}
          className="aspect-[3/2]"
        />
        <figcaption className="absolute top-2 left-2 rounded-full bg-white/90 px-[10px] py-[3px] text-[11px] font-semibold">
          {PHOTO_STANDARD_TEXT.positionLabel}
        </figcaption>
      </figure>
      {compact ? null : (
        <div className="grid grid-cols-2 gap-2">
          <figure className="m-0 flex flex-col gap-1">
            <GuideImage
              src={shotImage(shot.number, 'result')}
              alt={PHOTO_STANDARD_TEXT.resultAlt(shot.title)}
              className="aspect-[4/3] object-contain"
            />
            <figcaption className="text-[11px] ink-muted">
              {PHOTO_STANDARD_TEXT.resultLabel}
            </figcaption>
          </figure>
          <figure className="m-0 flex flex-col gap-1">
            <GuideImage
              src={shotImage(shot.number, 'plan')}
              alt={PHOTO_STANDARD_TEXT.planAlt(shot.title)}
              className="aspect-[4/3] object-contain"
            />
            <figcaption className="text-[11px] ink-muted">
              {PHOTO_STANDARD_TEXT.planLabel}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
