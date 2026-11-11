import { COLORS, FONT_STACK } from '../../reel/reel.constants';
import { ReelImage } from '../reel-image';

export type MonogramProps = {
  initials: string;
  logoSrc: string | null;
  size: number;
  tone?: 'light' | 'dark';
};

export function Monogram({ initials, logoSrc, size, tone = 'light' }: MonogramProps) {
  const background = tone === 'light' ? COLORS.white : COLORS.ink;
  const color = tone === 'light' ? COLORS.ink : COLORS.white;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {logoSrc === null ? (
        <span
          style={{
            fontFamily: FONT_STACK,
            fontSize: Math.round(size * 0.38),
            fontWeight: 800,
            color,
            letterSpacing: '-0.02em',
          }}
        >
          {initials}
        </span>
      ) : (
        <ReelImage src={logoSrc} fit="cover" style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
}
