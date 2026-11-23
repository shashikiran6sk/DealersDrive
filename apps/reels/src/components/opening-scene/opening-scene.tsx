import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';

import { COPY } from '../../copy/copy';
import { fitFontSize } from '../../lib/fit-text';
import { drift, enter } from '../../lib/motion';
import { COLORS, FONT_STACK, REEL_WIDTH, SAFE_AREA } from '../../reel/reel.constants';
import type { ReelDealer } from '../../reel/reel.types';
import { BilingualText } from '../bilingual-text';
import { BRAND_ICON_WHITE, BrandWordmark, ICON_RATIO } from '../brand-mark';
import { Chip } from '../chip';
import { Monogram } from '../monogram';
import { Reveal } from '../reveal';

import { OPENING } from './opening-scene.constants';

export type OpeningSceneProps = {
  dealer: ReelDealer;
  duration: number;
};

const CONTENT_WIDTH = REEL_WIDTH - SAFE_AREA.side * 2;

export function OpeningScene({ dealer, duration }: OpeningSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = dealer.name.split(/\s+/).filter((word) => word.length > 0);
  const nameSize = fitFontSize(dealer.name, {
    max: OPENING.nameMax,
    min: OPENING.nameMin,
    width: CONTENT_WIDTH,
    lines: 3,
  });
  const badge = enter(frame, fps, { delay: OPENING.monogramDelay, damping: 14 });
  const wordmark = enter(frame, fps);
  const iconY = drift(frame, duration, 0, OPENING.iconTravel);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black, overflow: 'hidden' }}>
      <Img
        src={BRAND_ICON_WHITE}
        style={{
          position: 'absolute',
          width: OPENING.iconWidth,
          height: Math.round(OPENING.iconWidth / ICON_RATIO),
          left: -260,
          top: 980,
          opacity: 0.06,
          transform: `translateY(${iconY}px) rotate(-8deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: SAFE_AREA.top + 20,
          left: SAFE_AREA.side,
          opacity: wordmark,
        }}
      >
        <BrandWordmark tone="white" height={40} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: SAFE_AREA.side,
          right: SAFE_AREA.side,
          top: 420,
          bottom: SAFE_AREA.bottom,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 34,
        }}
      >
        <div style={{ transform: `scale(${badge})`, transformOrigin: 'left center' }}>
          <Monogram initials={dealer.initials} logoSrc={dealer.logoSrc} size={180} />
        </div>
        <Reveal delay={OPENING.kickerDelay}>
          <BilingualText
            text={COPY.kicker}
            size={34}
            color={COLORS.faint}
            uppercase
            taScale={0.9}
          />
        </Reveal>
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: nameSize * 0.26 }}>
          {words.map((word, index) => (
            <Reveal
              key={`${word}-${index}`}
              delay={OPENING.nameDelay + index * OPENING.wordStagger}
            >
              <span
                style={{
                  fontFamily: FONT_STACK,
                  fontSize: nameSize,
                  fontWeight: 800,
                  color: COLORS.white,
                  lineHeight: 1.04,
                  letterSpacing: '-0.035em',
                }}
              >
                {word}
              </span>
            </Reveal>
          ))}
        </div>
        <Reveal delay={OPENING.locationDelay}>
          <BilingualText
            text={dealer.location}
            size={44}
            weight={600}
            color={COLORS.rule}
            taColor={COLORS.faint}
            taScale={0.8}
          />
        </Reveal>
        {dealer.isVerified ? (
          <Reveal delay={OPENING.locationDelay + 6}>
            <Chip text={COPY.verified} size={32} tone="dark" />
          </Reveal>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
