import { COLORS, FONT_STACK, TAMIL_FONT_STACK } from '../../reel/reel.constants';
import type { Bilingual } from '../../reel/reel.types';

export type ChipProps = {
  text: Bilingual;
  size: number;
  tone?: 'light' | 'dark';
};

const TONES = {
  light: { background: COLORS.white, border: COLORS.rule, en: COLORS.ink, ta: COLORS.muted },
  dark: { background: COLORS.inkSoft, border: COLORS.inkSoft, en: COLORS.white, ta: COLORS.faint },
} as const;

export function Chip({ text, size, tone = 'light' }: ChipProps) {
  const colors = TONES[tone];
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: `${Math.round(size * 0.5)}px ${Math.round(size * 0.75)}px`,
        borderRadius: Math.round(size * 0.7),
        backgroundColor: colors.background,
        border: `3px solid ${colors.border}`,
        boxShadow: tone === 'light' ? '0 14px 38px rgb(20 20 18 / 0.08)' : 'none',
      }}
    >
      <span
        style={{
          fontFamily: FONT_STACK,
          fontSize: size,
          fontWeight: 700,
          color: colors.en,
          lineHeight: 1.1,
        }}
      >
        {text.en}
      </span>
      {text.ta === null ? null : (
        <span
          style={{
            fontFamily: TAMIL_FONT_STACK,
            fontSize: Math.round(size * 0.66),
            fontWeight: 600,
            color: colors.ta,
            lineHeight: 1.35,
            marginTop: 4,
          }}
        >
          {text.ta}
        </span>
      )}
    </div>
  );
}
