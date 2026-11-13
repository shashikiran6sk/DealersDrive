import { POSTURE_LABELS, PHOTO_STANDARD_TEXT } from './photo-standard.constants';
import type { Posture } from './photo-standard.types';

const INK = 'var(--color-ink)';
const FOCUS = 'var(--color-focus)';

function Standing() {
  return (
    <g stroke={INK} strokeWidth={2.5} strokeLinecap="round" fill="none">
      <circle cx={22} cy={14} r={6} fill={INK} />
      <line x1={22} y1={21} x2={22} y2={46} />
      <line x1={22} y1={46} x2={15} y2={70} />
      <line x1={22} y1={46} x2={29} y2={70} />
      <polyline points="22,28 32,30 36,27" />
      <rect x={35} y={22} width={5} height={9} rx={1} fill={FOCUS} stroke="none" />
    </g>
  );
}

function Kneeling() {
  return (
    <g stroke={INK} strokeWidth={2.5} strokeLinecap="round" fill="none">
      <circle cx={22} cy={33} r={6} fill={INK} />
      <line x1={22} y1={40} x2={22} y2={57} />
      <polyline points="22,57 34,57 34,70" />
      <polyline points="22,57 14,70 6,70" />
      <polyline points="22,46 32,49 36,47" />
      <rect x={35} y={43} width={5} height={9} rx={1} fill={FOCUS} stroke="none" />
    </g>
  );
}

function Seated() {
  return (
    <g stroke={INK} strokeWidth={2.5} strokeLinecap="round" fill="none">
      <path
        d="M6 70 L6 30 Q6 24 12 24 L14 24 L14 56 L40 56 L40 70"
        stroke="var(--color-neutral-400)"
      />
      <circle cx={22} cy={28} r={6} fill={INK} />
      <line x1={22} y1={35} x2={22} y2={54} />
      <polyline points="22,54 36,54 38,68" />
      <polyline points="22,40 32,40 36,38" />
      <rect x={35} y={34} width={5} height={9} rx={1} fill={FOCUS} stroke="none" />
    </g>
  );
}

const CAMERA_HEIGHT: Record<Posture, number> = { stand: 27, kneel: 47, inside: 38 };

export function PostureFigure({ posture, className }: { posture: Posture; className?: string }) {
  const eye = CAMERA_HEIGHT[posture];
  return (
    <svg
      viewBox="0 0 140 80"
      role="img"
      aria-label={PHOTO_STANDARD_TEXT.postureAlt(POSTURE_LABELS[posture])}
      className={className}
    >
      <line x1={0} y1={71} x2={140} y2={71} stroke="var(--color-neutral-400)" strokeWidth={1.5} />
      {posture === 'inside' ? (
        <path
          d="M58 70 L58 30 Q60 18 80 16 L118 16 Q136 18 138 40 L138 70"
          fill="none"
          stroke="var(--color-neutral-400)"
          strokeWidth={2}
          strokeDasharray="3 3"
        />
      ) : (
        <g>
          <path
            d="M66 64 L66 50 Q68 44 78 43 L90 34 Q96 30 110 30 L122 30 Q130 31 134 42 L138 46 L138 64 Z"
            fill="var(--color-page)"
            stroke={INK}
            strokeWidth={2}
          />
          <circle cx={80} cy={64} r={6.5} fill="var(--color-neutral-800)" />
          <circle cx={124} cy={64} r={6.5} fill="var(--color-neutral-800)" />
          <rect x={64} y={50} width={4} height={4} fill="var(--color-warn)" />
        </g>
      )}
      <line
        x1={41}
        y1={eye}
        x2={posture === 'inside' ? 120 : 66}
        y2={posture === 'inside' ? 32 : 52}
        stroke={FOCUS}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      {posture === 'stand' ? <Standing /> : posture === 'kneel' ? <Kneeling /> : <Seated />}
    </svg>
  );
}
