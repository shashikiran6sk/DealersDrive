import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { COPY, featuredIndex } from '../../copy/copy';
import { fitFontSize } from '../../lib/fit-text';
import { drift, enter, exit } from '../../lib/motion';
import {
  COLORS,
  FONT_STACK,
  REEL_WIDTH,
  SAFE_AREA,
  TAMIL_FONT_STACK,
} from '../../reel/reel.constants';
import type { ReelCar } from '../../reel/reel.types';
import { BilingualText } from '../bilingual-text';
import { Chip } from '../chip';
import { ReelImage } from '../reel-image';
import { Reveal } from '../reveal';

import { CAR } from './car-scene.constants';

export type CarSceneProps = {
  car: ReelCar;
  position: number;
  total: number;
  duration: number;
};

const CONTENT_WIDTH = REEL_WIDTH - SAFE_AREA.side * 2;

export function CarScene({ car, position, total, duration }: CarSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arrive = enter(frame, fps, { damping: CAR.carDamping });
  const leave = exit(frame, duration, CAR.exitFrames);
  const carX = (1 - arrive) * CAR.carTravel - leave * CAR.carTravel * 1.15;
  const carScale = drift(frame, duration, 1, CAR.carZoom);
  const yearX = drift(frame, duration, CAR.yearTravel, -CAR.yearTravel);
  const yearIn = enter(frame, fps, { delay: 2 });
  const titleSize = fitFontSize(car.title, {
    max: CAR.titleMax,
    min: CAR.titleMin,
    width: CONTENT_WIDTH,
    lines: 2,
  });
  const fade = 1 - leave;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.photo, overflow: 'hidden' }}>
      {car.year === null ? null : (
        <div
          style={{
            position: 'absolute',
            top: CAR.yearTop,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: FONT_STACK,
            fontSize: CAR.yearSize,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: 'transparent',
            WebkitTextStroke: `4px ${COLORS.outline}`,
            opacity: yearIn * fade,
            transform: `translateX(${yearX}px)`,
          }}
        >
          {car.year}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: SAFE_AREA.top + 20,
          left: SAFE_AREA.side,
          right: SAFE_AREA.side,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          opacity: fade,
        }}
      >
        <Reveal delay={4}>
          <BilingualText
            text={COPY.featured}
            size={30}
            color={COLORS.muted}
            uppercase
            taScale={0.95}
          />
        </Reveal>
        <Reveal delay={4}>
          <span
            style={{ fontFamily: FONT_STACK, fontSize: 34, fontWeight: 800, color: COLORS.ink }}
          >
            {featuredIndex(position, total)}
          </span>
        </Reveal>
      </div>

      <div
        style={{
          position: 'absolute',
          top: CAR.photoTop,
          left: 0,
          width: REEL_WIDTH,
          height: CAR.photoHeight,
          transform: `translateX(${carX}px) scale(${carScale})`,
          mixBlendMode: 'darken',
        }}
      >
        <ReelImage src={car.imageSrc} fit="contain" style={{ width: '100%', height: '100%' }} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: SAFE_AREA.side,
          right: SAFE_AREA.side,
          top: CAR.detailsTop,
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
          opacity: fade,
          transform: `translateX(${-leave * 80}px)`,
        }}
      >
        <Reveal delay={CAR.titleDelay}>
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: titleSize,
              fontWeight: 800,
              color: COLORS.ink,
              lineHeight: 1.04,
              letterSpacing: '-0.03em',
            }}
          >
            {car.title}
          </div>
        </Reveal>

        <Reveal delay={CAR.priceDelay} from="left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div
              style={{
                backgroundColor: COLORS.black,
                color: COLORS.white,
                borderRadius: 999,
                padding: '14px 36px 16px',
                fontFamily: FONT_STACK,
                fontSize: car.price === null ? 40 : 64,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              {car.price ?? COPY.priceOnRequest.en}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontFamily: FONT_STACK,
                  fontSize: 28,
                  fontWeight: 700,
                  color: COLORS.muted,
                }}
              >
                {car.price === null ? '' : COPY.price.en}
              </span>
              <span
                style={{
                  fontFamily: TAMIL_FONT_STACK,
                  fontSize: 26,
                  fontWeight: 600,
                  color: COLORS.faint,
                }}
              >
                {car.price === null ? COPY.priceOnRequest.ta : COPY.price.ta}
              </span>
            </div>
          </div>
        </Reveal>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {car.specs.map((spec, index) => {
            const pop = enter(frame, fps, {
              delay: CAR.specDelay + index * CAR.specStagger,
              durationInFrames: CAR.popFrames,
            });
            return (
              <div
                key={spec.en}
                style={{
                  transform: `translateY(${(1 - pop) * 40}px)`,
                  opacity: Math.min(1, pop * 1.4),
                }}
              >
                <Chip text={spec} size={CAR.specSize} />
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
