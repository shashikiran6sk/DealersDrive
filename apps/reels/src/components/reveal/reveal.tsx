import type { CSSProperties, ReactNode } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

import { enter } from '../../lib/motion';

export type RevealProps = {
  children: ReactNode;
  delay?: number;
  from?: 'below' | 'left';
  style?: CSSProperties;
};

const TRAVEL_PERCENT = 115;
const REVEAL_FRAMES = 16;

export function Reveal({ children, delay = 0, from = 'below', style }: RevealProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = enter(frame, fps, { delay, durationInFrames: REVEAL_FRAMES });
  const offset = (1 - progress) * TRAVEL_PERCENT;
  const transform = from === 'below' ? `translateY(${offset}%)` : `translateX(${-offset}%)`;

  return (
    <div style={{ overflow: 'hidden', paddingBottom: 6, ...style }}>
      <div style={{ transform, opacity: progress > 0.01 ? 1 : 0 }}>{children}</div>
    </div>
  );
}
