import type { CSSProperties } from 'react';

import { FONT_STACK, TAMIL_FONT_STACK } from '../../reel/reel.constants';
import type { Bilingual } from '../../reel/reel.types';

export type BilingualTextProps = {
  text: Bilingual;
  size: number;
  color: string;
  taColor?: string;
  weight?: number;
  taScale?: number;
  align?: 'left' | 'center';
  uppercase?: boolean;
  style?: CSSProperties;
};

const TAMIL_WEIGHT = 600;
const DEFAULT_TA_SCALE = 0.58;

export function BilingualText({
  text,
  size,
  color,
  taColor,
  weight = 700,
  taScale = DEFAULT_TA_SCALE,
  align = 'left',
  uppercase = false,
  style,
}: BilingualTextProps) {
  return (
    <div style={{ textAlign: align, ...style }}>
      <div
        style={{
          fontFamily: FONT_STACK,
          fontSize: size,
          fontWeight: weight,
          color,
          lineHeight: 1.12,
          letterSpacing: uppercase ? '0.14em' : '-0.01em',
          textTransform: uppercase ? 'uppercase' : 'none',
        }}
      >
        {text.en}
      </div>
      {text.ta === null ? null : (
        <div
          style={{
            fontFamily: TAMIL_FONT_STACK,
            fontSize: Math.round(size * taScale),
            fontWeight: TAMIL_WEIGHT,
            color: taColor ?? color,
            lineHeight: 1.4,
            marginTop: Math.round(size * 0.12),
          }}
        >
          {text.ta}
        </div>
      )}
    </div>
  );
}
