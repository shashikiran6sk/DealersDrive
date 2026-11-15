import { GuideImage } from './guide-image';
import { PHOTO_STANDARD_TEXT, POSES } from './photo-standard.constants';
import { FactTile as Fact } from './fact-tile';
import type { ShotGuide } from './photo-standard.types';

export function ShotFacts({ shot }: { shot: ShotGuide }) {
  const pose = POSES.find((one) => one.pose === shot.pose);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="flex items-center gap-2 rounded-[10px] border border-(--color-focus)/30 bg-[color-mix(in_srgb,var(--color-focus)_7%,white)] p-[8px]">
        {pose ? (
          <GuideImage
            src={pose.image}
            alt={PHOTO_STANDARD_TEXT.poseAlt(pose.title)}
            className="h-[52px] w-[44px] flex-none rounded-[6px]"
          />
        ) : null}
        <span className="flex flex-col">
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase ink-muted">
            {PHOTO_STANDARD_TEXT.facts.pose}
          </span>
          <span className="text-[13px] font-semibold leading-tight">{pose?.title}</span>
        </span>
      </div>
      <Fact label={PHOTO_STANDARD_TEXT.facts.height} fact={shot.height} />
      <Fact label={PHOTO_STANDARD_TEXT.facts.distance} fact={shot.distance} />
      <Fact label={PHOTO_STANDARD_TEXT.facts.hold} fact={shot.hold} />
    </div>
  );
}
