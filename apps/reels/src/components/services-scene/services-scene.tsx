import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { COPY } from '../../copy/copy';
import { enter, exit, wipe } from '../../lib/motion';
import { COLORS, FONT_STACK, SAFE_AREA } from '../../reel/reel.constants';
import type { ReelDealer } from '../../reel/reel.types';
import { BilingualText } from '../bilingual-text';
import { Chip } from '../chip';
import { Reveal } from '../reveal';

import { SERVICES } from './services-scene.constants';

export type ServicesSceneProps = {
  dealer: ReelDealer;
  duration: number;
};

export function ServicesScene({ dealer, duration }: ServicesSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cover = wipe(frame, SERVICES.wipeFrames);
  const leaving = exit(frame, duration, SERVICES.exitFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <AbsoluteFill
        style={{
          backgroundColor: COLORS.paper,
          transform: `translateY(${cover * 100}%)`,
          borderTopLeftRadius: cover > 0 ? 48 : 0,
          borderTopRightRadius: cover > 0 ? 48 : 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: SAFE_AREA.side,
            right: SAFE_AREA.side,
            top: SAFE_AREA.top + 20,
            bottom: SAFE_AREA.bottom,
            display: 'flex',
            flexDirection: 'column',
            opacity: 1 - leaving,
            transform: `translateY(${-leaving * 60}px)`,
          }}
        >
          <Reveal delay={SERVICES.nameDelay}>
            <span
              style={{ fontFamily: FONT_STACK, fontSize: 34, fontWeight: 700, color: COLORS.muted }}
            >
              {dealer.name}
            </span>
          </Reveal>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 56,
            }}
          >
            <Reveal delay={SERVICES.headingDelay}>
              <BilingualText
                text={COPY.servicesHeading}
                size={88}
                weight={800}
                color={COLORS.ink}
                taColor={COLORS.muted}
                taScale={0.5}
              />
            </Reveal>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22 }}>
              {dealer.services.map((service, index) => {
                const pop = enter(frame, fps, {
                  delay: SERVICES.chipDelay + index * SERVICES.chipStagger,
                  durationInFrames: SERVICES.popFrames,
                });
                return (
                  <div
                    key={service.en}
                    style={{
                      transform: `scale(${0.7 + pop * 0.3})`,
                      opacity: Math.min(1, pop * 1.4),
                      transformOrigin: 'left center',
                    }}
                  >
                    <Chip text={service} size={SERVICES.chipSize} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
