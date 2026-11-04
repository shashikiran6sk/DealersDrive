import { Audio, interpolate, Sequence } from 'remotion';

import { REEL_DURATION } from '../../reel/reel.constants';
import type { ReelSound } from '../../reel/reel.types';
import { resolveSrc } from '../reel-image';

import { SOUND } from './dealer-reel.constants';

export type SoundtrackProps = {
  sound: ReelSound;
  cuts: number[];
};

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function Soundtrack({ sound, cuts }: SoundtrackProps) {
  return (
    <>
      {sound.music === null ? null : (
        <Audio
          src={resolveSrc(sound.music)}
          volume={(frame) =>
            interpolate(
              frame,
              [0, SOUND.fadeInFrames, REEL_DURATION - SOUND.fadeOutFrames, REEL_DURATION],
              [0, SOUND.musicVolume, SOUND.musicVolume, 0],
              CLAMP,
            )
          }
        />
      )}
      {sound.whoosh === null
        ? null
        : cuts.map((cut) => (
            <Sequence
              key={cut}
              from={cut - SOUND.whooshLeadFrames}
              durationInFrames={SOUND.whooshFrames}
              name="whoosh"
              layout="none"
            >
              <Audio src={resolveSrc(sound.whoosh ?? '')} volume={SOUND.whooshVolume} />
            </Sequence>
          ))}
    </>
  );
}
