import { AbsoluteFill, Sequence } from 'remotion';

import { buildTimeline, cutFrames } from '../../lib/timeline';
import { COLORS, FONT_STACK } from '../../reel/reel.constants';
import type { ReelProps } from '../../reel/reel.types';

import { Scene } from './scene';
import { Soundtrack } from './soundtrack';

export function DealerReel(props: ReelProps) {
  const timeline = buildTimeline({
    hasServices: props.dealer.services.length > 0,
    carCount: props.featured.length,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black, fontFamily: FONT_STACK }}>
      {timeline.scenes.map((slot) => (
        <Sequence
          key={slot.name}
          from={slot.from}
          durationInFrames={slot.duration}
          name={slot.name}
        >
          <Scene slot={slot} props={props} cars={timeline.cars} />
        </Sequence>
      ))}
      <Soundtrack sound={props.sound} cuts={cutFrames(timeline)} />
    </AbsoluteFill>
  );
}
