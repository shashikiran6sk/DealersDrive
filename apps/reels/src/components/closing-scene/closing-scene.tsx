import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { COPY } from '../../copy/copy';
import { enter } from '../../lib/motion';
import { COLORS, FONT_STACK, SAFE_AREA } from '../../reel/reel.constants';
import type { Bilingual, ReelDealer } from '../../reel/reel.types';
import { BilingualText } from '../bilingual-text';
import { BrandWordmark } from '../brand-mark';
import { Monogram } from '../monogram';
import { QrCode } from '../qr-code';
import { Reveal } from '../reveal';

import { CLOSING } from './closing-scene.constants';

export type ClosingSceneProps = {
  dealer: ReelDealer;
  pageUrl: string;
  asOf: Bilingual;
};

export function ClosingScene({ dealer, pageUrl, asOf }: ClosingSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = enter(frame, fps, { delay: CLOSING.cardDelay, damping: 15 });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <div
        style={{
          position: 'absolute',
          top: SAFE_AREA.top + 10,
          left: SAFE_AREA.side,
          right: SAFE_AREA.side,
          bottom: SAFE_AREA.bottom - 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Reveal delay={2}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Monogram initials={dealer.initials} logoSrc={dealer.logoSrc} size={96} />
            <span
              style={{
                fontFamily: FONT_STACK,
                fontSize: 56,
                fontWeight: 800,
                color: COLORS.white,
                letterSpacing: '-0.03em',
              }}
            >
              {dealer.name}
            </span>
          </div>
        </Reveal>

        <div
          style={{
            backgroundColor: COLORS.white,
            borderRadius: 44,
            padding: 34,
            transform: `scale(${0.8 + card * 0.2})`,
            opacity: Math.min(1, card * 1.4),
            boxShadow: '0 24px 70px rgb(0 0 0 / 0.45)',
          }}
        >
          <QrCode value={pageUrl} size={CLOSING.qrSize} color={COLORS.black} />
        </div>

        <Reveal delay={CLOSING.scanDelay}>
          <BilingualText
            text={COPY.scan}
            size={54}
            weight={800}
            color={COLORS.white}
            taColor={COLORS.faint}
            taScale={0.6}
            align="center"
          />
        </Reveal>

        <Reveal delay={CLOSING.brandDelay}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <BrandWordmark tone="white" height={44} />
            <BilingualText
              text={asOf}
              size={24}
              weight={600}
              color={COLORS.faint}
              taScale={0.95}
              align="center"
            />
          </div>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
}
