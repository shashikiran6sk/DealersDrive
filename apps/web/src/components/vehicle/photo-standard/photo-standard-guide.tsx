import { PostureFigure } from './posture-figure';
import { PHOTO_STANDARD_TEXT, POSTURE_LABELS, SHOT_GUIDES } from './photo-standard.constants';
import { PhotoWalkround } from './photo-walkround';
import { ShotDiagram } from './shot-diagram';
import type { ShotGuide } from './photo-standard.types';

export function ShotInstructions({ shot }: { shot: ShotGuide }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
      <dt className="ink-muted">{PHOTO_STANDARD_TEXT.whereLabel}</dt>
      <dd>{shot.where}</dd>
      <dt className="ink-muted">{PHOTO_STANDARD_TEXT.postureLabel}</dt>
      <dd className="font-medium">{POSTURE_LABELS[shot.posture]}</dd>
      <dt className="ink-muted">{PHOTO_STANDARD_TEXT.howLabel}</dt>
      <dd>{shot.how}</dd>
      <dt className="ink-muted">{PHOTO_STANDARD_TEXT.checkLabel}</dt>
      <dd>{shot.check}</dd>
    </dl>
  );
}

export function ShotIllustration({ shot }: { shot: ShotGuide }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-end gap-2">
      <ShotDiagram shot={shot} className="h-auto w-full" />
      <PostureFigure posture={shot.posture} className="h-auto w-full" />
    </div>
  );
}

export function PhotoStandardGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid gap-[18px] md:grid-cols-[220px_1fr]">
        <figure className="flex flex-col gap-2">
          <PhotoWalkround className="h-auto w-full max-w-[260px]" />
          <figcaption className="text-[12px] ink-muted">
            {PHOTO_STANDARD_TEXT.walkroundCaption}
          </figcaption>
        </figure>
        <div className="flex flex-col gap-2">
          <h3 className="text-[16px]">{PHOTO_STANDARD_TEXT.before}</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] ink-body">
            {PHOTO_STANDARD_TEXT.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
      {compact ? null : (
        <ol className="grid gap-[14px] sm:grid-cols-2">
          {SHOT_GUIDES.map((shot) => (
            <li key={shot.slot} className="card flex flex-col gap-3 p-[16px]">
              <p className="text-[12px] font-semibold tracking-[0.06em] uppercase ink-muted">
                {PHOTO_STANDARD_TEXT.shotLabel(shot.number)}
              </p>
              <h4 className="-mt-2 text-[17px]">{shot.title}</h4>
              <ShotIllustration shot={shot} />
              <ShotInstructions shot={shot} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
