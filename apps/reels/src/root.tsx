import { Composition } from 'remotion';

import { DealerReel } from './components/dealer-reel';
import { loadFonts } from './fonts';
import {
  REEL_COMPOSITION_ID,
  REEL_DURATION,
  REEL_FPS,
  REEL_HEIGHT,
  REEL_WIDTH,
} from './reel/reel.constants';
import { SAMPLE_PROPS } from './reel/sample-props';

loadFonts();

export function RemotionRoot() {
  return (
    <Composition
      id={REEL_COMPOSITION_ID}
      component={DealerReel}
      durationInFrames={REEL_DURATION}
      fps={REEL_FPS}
      width={REEL_WIDTH}
      height={REEL_HEIGHT}
      defaultProps={SAMPLE_PROPS}
    />
  );
}
