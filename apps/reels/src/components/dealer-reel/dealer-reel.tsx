import { AbsoluteFill, Audio, interpolate, Sequence } from 'remotion';

import { buildTimeline } from '../../lib/timeline';
import { COLORS, FONT_STACK, REEL_DURATION } from '../../reel/reel.constants';
import type { ReelProps } from '../../reel/reel.types';
import { resolveSrc } from '../reel-image';

import { Scene } from './scene';

const MUSIC_FADE_FRAMES = 20;

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
      {props.musicSrc === null ? null : (
        <Audio
          src={resolveSrc(props.musicSrc)}
          volume={(frame) =>
            interpolate(
              frame,
              [0, MUSIC_FADE_FRAMES, REEL_DURATION - MUSIC_FADE_FRAMES, REEL_DURATION],
              [0, 1, 1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            )
          }
        />
      )}
    </AbsoluteFill>
  );
}
