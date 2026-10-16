import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/tokens';

const paths = {
  close: 'm6 6 12 12M6 18 18 6',
  back: 'm15 5-7 7 7 7M8 12h13',
  chevron: 'm6 9 6 6 6-6',
  location: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  sort: 'M4 6h16M7 12h10M10 18h4',
  filters: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
} as const;

export function Icon({
  name,
  size = 22,
  color = colors.ink,
  filled = false,
}: {
  name: keyof typeof paths;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={paths[name]}
        stroke={color}
        strokeWidth={1.8}
        fill={filled ? color : 'none'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
