import { CarPlan } from './car-plan';
import { PHOTO_STANDARD_TEXT, PLAN_VIEWBOX, SHOT_GUIDES } from './photo-standard.constants';
import { viewCone } from './utils';

export interface PhotoWalkroundProps {
  highlight?: number;
  done?: readonly number[];
  className?: string;
}

export function PhotoWalkround({ highlight, done = [], className }: PhotoWalkroundProps) {
  const exterior = SHOT_GUIDES.filter((shot) => shot.posture !== 'inside' && !shot.openDoor);
  return (
    <svg
      viewBox={PLAN_VIEWBOX}
      role="img"
      aria-label={PHOTO_STANDARD_TEXT.walkroundCaption}
      className={className}
    >
      <rect x={0} y={0} width={200} height={240} rx={12} fill="var(--color-accent-100)" />
      <CarPlan />
      {exterior.map((shot) => (
        <polygon
          key={`cone-${shot.slot}`}
          points={viewCone(shot.photographer, shot.target, 0.55)}
          fill="var(--color-focus)"
          opacity={highlight === shot.number ? 0.28 : 0.08}
        />
      ))}
      {SHOT_GUIDES.map((shot) => {
        const complete = done.includes(shot.number);
        const active = highlight === shot.number;
        return (
          <g key={shot.slot}>
            <circle
              cx={shot.photographer.x}
              cy={shot.photographer.y}
              r={active ? 10 : 8}
              fill={
                complete ? 'var(--color-ok)' : active ? 'var(--color-focus)' : 'var(--color-ink)'
              }
            />
            <text
              x={shot.photographer.x}
              y={shot.photographer.y + 3}
              textAnchor="middle"
              fontSize={active ? 10 : 8.5}
              fontWeight={700}
              fill="#ffffff"
            >
              {shot.number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
