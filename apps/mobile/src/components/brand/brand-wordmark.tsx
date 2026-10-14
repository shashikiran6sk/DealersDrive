import { SvgXml } from 'react-native-svg';

import vectors from '../../assets/brand/vectors.json';

import { BRAND_DIMENSIONS, BRAND_TEXT } from './brand.constants';
import type { BrandWordmarkProps } from './brand.types';

export function BrandWordmark({
  surface = 'light',
  width = BRAND_DIMENSIONS.defaultWordmarkWidth,
  decorative = false,
}: BrandWordmarkProps) {
  return (
    <SvgXml
      xml={
        surface === 'light'
          ? vectors['dealersdrive-wordmark-black']
          : vectors['dealersdrive-wordmark-white']
      }
      width={width}
      height={(width * BRAND_DIMENSIONS.wordmarkHeight) / BRAND_DIMENSIONS.wordmarkWidth}
      accessible={!decorative}
      accessibilityRole="image"
      accessibilityLabel={decorative ? undefined : BRAND_TEXT.label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
    />
  );
}
