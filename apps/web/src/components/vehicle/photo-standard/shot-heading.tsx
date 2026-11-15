import type { ShotGuide } from './photo-standard.types';
import { shotNumberLabel } from './utils';

export function ShotHeading({ shot, as: Tag = 'h3' }: { shot: ShotGuide; as?: 'h3' | 'h4' }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[30px] leading-none font-extrabold tracking-[-0.04em] text-(--color-focus) tnum">
        {shotNumberLabel(shot.number)}
      </span>
      <div className="flex flex-col gap-[2px]">
        <Tag className="text-[18px] leading-tight">
          {shot.title} <span className="font-semibold ink-muted">· {shot.side}</span>
        </Tag>
        <p className="text-[13px] ink-body">{shot.purpose}</p>
      </div>
    </div>
  );
}
