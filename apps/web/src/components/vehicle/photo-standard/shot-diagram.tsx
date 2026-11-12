import { CarPlan } from './car-plan';
import { PHOTO_STANDARD_TEXT, PLAN_VIEWBOX } from './photo-standard.constants';
import type { ShotGuide } from './photo-standard.types';
import { viewCone } from './utils';

export interface ShotDiagramProps {
  shot: ShotGuide;
  className?: string;
}

export function ShotDiagram({ shot, className }: ShotDiagramProps) {
  return (
    <svg
      viewBox={PLAN_VIEWBOX}
      role="img"
      aria-label={PHOTO_STANDARD_TEXT.planAlt(shot.title)}
      className={className}
    >
      <rect x={0} y={0} width={200} height={240} rx={12} fill="var(--color-accent-100)" />
      <text
        x={100}
        y={52}
        textAnchor="middle"
        fontSize={8}
        letterSpacing={2}
        fill="var(--color-neutral-600)"
      >
        {PHOTO_STANDARD_TEXT.front}
      </text>
      <text
        x={100}
        y={194}
        textAnchor="middle"
        fontSize={8}
        letterSpacing={2}
        fill="var(--color-neutral-600)"
      >
        {PHOTO_STANDARD_TEXT.rear}
      </text>
      <CarPlan {...(shot.openDoor ? { openDoor: shot.openDoor } : {})} />
      <polygon
        points={viewCone(shot.photographer, shot.target)}
        fill="var(--color-focus)"
        opacity={0.18}
      />
      <line
        x1={shot.photographer.x}
        y1={shot.photographer.y}
        x2={shot.target.x}
        y2={shot.target.y}
        stroke="var(--color-focus)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <circle cx={shot.photographer.x} cy={shot.photographer.y} r={10} fill="var(--color-focus)" />
      <text
        x={shot.photographer.x}
        y={shot.photographer.y + 3.5}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="#ffffff"
      >
        {shot.number}
      </text>
    </svg>
  );
}
