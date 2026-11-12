import { CAR } from './photo-standard.constants';
import type { ShotGuide } from './photo-standard.types';

const DOORS = {
  'front-left': { hinge: { x: CAR.x, y: 90 }, open: { x: CAR.x - 24, y: 110 } },
  'rear-left': { hinge: { x: CAR.x, y: 128 }, open: { x: CAR.x - 24, y: 148 } },
} as const;

export function CarPlan({ openDoor }: { openDoor?: ShotGuide['openDoor'] }) {
  const door = openDoor ? DOORS[openDoor] : null;
  const right = CAR.x + CAR.width;
  return (
    <g>
      {[78, 158].map((y) => (
        <g key={y}>
          <rect x={CAR.x - 5} y={y} width={6} height={18} rx={2} fill="var(--color-neutral-800)" />
          <rect x={right - 1} y={y} width={6} height={18} rx={2} fill="var(--color-neutral-800)" />
        </g>
      ))}
      <rect
        x={CAR.x}
        y={CAR.y}
        width={CAR.width}
        height={CAR.height}
        rx={18}
        fill="var(--color-page)"
        stroke="var(--color-ink)"
        strokeWidth={2}
      />
      <path
        d={`M${CAR.x + 8} 96 Q100 82 ${right - 8} 96 L${right - 10} 108 Q100 100 ${CAR.x + 10} 108 Z`}
        fill="var(--color-neutral-300)"
      />
      <rect
        x={CAR.x + 10}
        y={110}
        width={CAR.width - 20}
        height={34}
        rx={6}
        fill="var(--color-surface)"
      />
      <path
        d={`M${CAR.x + 10} 148 Q100 154 ${right - 10} 148 L${right - 8} 160 Q100 168 ${CAR.x + 8} 160 Z`}
        fill="var(--color-neutral-300)"
      />
      <rect x={CAR.x + 6} y={CAR.y + 3} width={11} height={4} rx={2} fill="var(--color-warn)" />
      <rect x={right - 17} y={CAR.y + 3} width={11} height={4} rx={2} fill="var(--color-warn)" />
      <rect
        x={CAR.x + 6}
        y={CAR.y + CAR.height - 7}
        width={11}
        height={4}
        rx={2}
        fill="var(--color-err)"
      />
      <rect
        x={right - 17}
        y={CAR.y + CAR.height - 7}
        width={11}
        height={4}
        rx={2}
        fill="var(--color-err)"
      />
      <rect x={CAR.x - 6} y={92} width={6} height={4} rx={1} fill="var(--color-ink)" />
      <rect x={right} y={92} width={6} height={4} rx={1} fill="var(--color-ink)" />
      <circle
        cx={114}
        cy={98}
        r={5}
        fill="none"
        stroke="var(--color-neutral-600)"
        strokeWidth={1.5}
      />
      {door ? (
        <line
          x1={door.hinge.x}
          y1={door.hinge.y}
          x2={door.open.x}
          y2={door.open.y}
          stroke="var(--color-ink)"
          strokeWidth={3}
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
}
