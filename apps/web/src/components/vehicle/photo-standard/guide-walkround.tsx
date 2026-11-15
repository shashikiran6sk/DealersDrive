import { GuideImage } from './guide-image';
import { PHOTO_GUIDE_ASSETS, PHOTO_STANDARD_TEXT } from './photo-standard.constants';

export function GuideWalkround({ className }: { className?: string }) {
  return (
    <figure
      className={className ? `m-0 flex flex-col gap-1 ${className}` : 'm-0 flex flex-col gap-1'}
    >
      <GuideImage src={PHOTO_GUIDE_ASSETS.walkround} alt={PHOTO_STANDARD_TEXT.walkroundAlt} eager />
      <figcaption className="text-[12px] ink-muted">
        <strong className="font-semibold text-(--color-ink)">{PHOTO_STANDARD_TEXT.lap}</strong>{' '}
        {PHOTO_STANDARD_TEXT.lapBody}
      </figcaption>
    </figure>
  );
}
