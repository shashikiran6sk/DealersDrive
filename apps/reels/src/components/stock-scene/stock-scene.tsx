import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { availableLabel, COPY } from '../../copy/copy';
import { countUp, enter, exit, wipe } from '../../lib/motion';
import { COLORS, FONT_STACK, REEL_WIDTH, SAFE_AREA } from '../../reel/reel.constants';
import { BilingualText } from '../bilingual-text';
import { ReelImage } from '../reel-image';
import { Reveal } from '../reveal';

import { STOCK } from './stock-scene.constants';
import { gridShape } from './utils';

export type StockSceneProps = {
  gallery: string[];
  availableCount: number;
  priceRange: string | null;
  duration: number;
};

export function StockScene({ gallery, availableCount, priceRange, duration }: StockSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cover = wipe(frame, STOCK.wipeFrames);
  const leaving = exit(frame, duration, STOCK.exitFrames);
  const shape = gridShape(gallery.length, STOCK.gridWidth, STOCK.gap);
  const count = countUp(frame, availableCount, STOCK.countDelay, STOCK.countLength);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.photo }}>
      <AbsoluteFill
        style={{
          backgroundColor: COLORS.black,
          transform: `translateY(${cover * 100}%)`,
          borderTopLeftRadius: cover > 0 ? 48 : 0,
          borderTopRightRadius: cover > 0 ? 48 : 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: SAFE_AREA.top + 10,
            left: (REEL_WIDTH - STOCK.gridWidth) / 2,
            width: STOCK.gridWidth,
            display: 'grid',
            gridTemplateColumns: `repeat(${shape.columns}, ${shape.tile}px)`,
            gap: STOCK.gap,
            opacity: 1 - leaving,
            transform: `scale(${1 - leaving * 0.08})`,
          }}
        >
          {gallery.map((src, index) => {
            const pop = enter(frame, fps, {
              delay: STOCK.tileDelay + index * STOCK.tileStagger,
              durationInFrames: STOCK.popFrames,
            });
            return (
              <div
                key={src}
                style={{
                  width: shape.tile,
                  height: shape.tile,
                  borderRadius: 28,
                  overflow: 'hidden',
                  backgroundColor: COLORS.photo,
                  transform: `scale(${0.55 + pop * 0.45})`,
                  opacity: Math.min(1, pop * 1.5),
                }}
              >
                <ReelImage
                  src={src}
                  fit="contain"
                  style={{ width: '100%', height: '100%', transform: 'scale(1.12)' }}
                />
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: 'absolute',
            left: SAFE_AREA.side,
            right: SAFE_AREA.side,
            bottom: SAFE_AREA.bottom,
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            opacity: 1 - leaving,
          }}
        >
          <Reveal delay={STOCK.countDelay}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
              <span
                style={{
                  fontFamily: FONT_STACK,
                  fontSize: 170,
                  fontWeight: 800,
                  color: COLORS.white,
                  lineHeight: 0.9,
                  letterSpacing: '-0.05em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {count}
              </span>
              <BilingualText
                text={availableLabel(availableCount)}
                size={50}
                weight={800}
                color={COLORS.white}
                taColor={COLORS.faint}
                taScale={0.68}
                style={{ paddingBottom: 6 }}
              />
            </div>
          </Reveal>
          {priceRange === null ? null : (
            <Reveal delay={STOCK.rangeDelay}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <BilingualText
                  text={COPY.priceRange}
                  size={28}
                  color={COLORS.faint}
                  uppercase
                  taScale={0.95}
                />
                <span
                  style={{
                    fontFamily: FONT_STACK,
                    fontSize: 50,
                    fontWeight: 800,
                    color: COLORS.white,
                  }}
                >
                  {priceRange}
                </span>
              </div>
            </Reveal>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
