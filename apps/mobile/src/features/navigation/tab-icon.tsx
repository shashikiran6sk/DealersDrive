import Svg, { Path } from 'react-native-svg';
import type { ColorValue } from 'react-native';

export type TabName = 'home' | 'cars' | 'dealers' | 'saved' | 'profile';

const PATHS: Record<TabName, string> = {
  home: 'M3 10 12 3l9 7v10h-6v-6H9v6H3Z',
  cars: 'm5 6-2 7v6h3v-3h12v3h3v-6l-2-7ZM3 12h18M7 6h10M7 14h1m8 0h1',
  dealers: 'M3 10h18L19 4H5ZM5 10v11h14V10M8 21v-7h8v7M2 21h20',
  saved:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21v-2a8 8 0 0 1 16 0v2',
};

export function TabIcon({ name, color }: { name: TabName; color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={PATHS[name]}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
