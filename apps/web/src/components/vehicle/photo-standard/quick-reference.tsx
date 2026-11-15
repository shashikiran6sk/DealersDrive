import { GuideImage } from './guide-image';
import { PHOTO_STANDARD_TEXT, POSES, SHOT_GUIDES } from './photo-standard.constants';
import { shotImage, shotNumberLabel } from './utils';

export function QuickReference() {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="quick-reference">
      <h3 id="quick-reference" className="text-[20px]">
        {PHOTO_STANDARD_TEXT.quickTitle}
      </h3>
      <p className="text-[13px] ink-muted">{PHOTO_STANDARD_TEXT.quickIntro}</p>
      <ol className="flex flex-col divide-y divide-(--color-divider) rounded-[12px] border border-(--color-divider)">
        {SHOT_GUIDES.map((shot) => (
          <li
            key={shot.slot}
            className="grid grid-cols-[64px_1fr] items-center gap-3 p-[8px] sm:grid-cols-[72px_1.3fr_1fr_1fr_0.7fr]"
          >
            <GuideImage
              src={shotImage(shot.number, 'result')}
              alt={PHOTO_STANDARD_TEXT.resultAlt(shot.title)}
              className="aspect-[4/3] object-contain"
            />
            <span className="text-[13px]">
              <strong className="font-semibold">
                {shotNumberLabel(shot.number)} {shot.title}
              </strong>
              <span className="block text-[11px] ink-muted">{shot.side}</span>
            </span>
            <span className="text-[12px] max-sm:col-start-2">
              {shot.distance.value} <span className="ink-muted">{shot.distance.note}</span>
            </span>
            <span className="text-[12px] max-sm:col-start-2">
              {POSES.find((pose) => pose.pose === shot.pose)?.title} · {shot.height.value}
            </span>
            <span className="text-[12px] font-medium max-sm:col-start-2">{shot.hold.value}</span>
          </li>
        ))}
      </ol>
      <p className="rounded-[12px] border border-(--color-focus)/25 bg-[color-mix(in_srgb,var(--color-focus)_7%,white)] p-[12px] text-[13px]">
        <strong className="font-semibold">{PHOTO_STANDARD_TEXT.lastCheckTitle}</strong>{' '}
        {PHOTO_STANDARD_TEXT.lastCheck}
      </p>
    </section>
  );
}
