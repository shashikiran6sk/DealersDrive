import { SvgXml } from 'react-native-svg';

import vectors from '../../assets/brand/vectors.json';

import { BRAND_DIMENSIONS, BRAND_TEXT } from './brand.constants';
import type { BrandSymbolProps } from './brand.types';

export function BrandSymbol({
  surface = 'light',
  height = BRAND_DIMENSIONS.defaultSymbolHeight,
  decorative = false,
}: BrandSymbolProps) {
  return (
    <SvgXml
      xml={surface === 'light' ? vectors['dd-icon-black'] : vectors['dd-icon-white']}
      width={(height * BRAND_DIMENSIONS.symbolWidth) / BRAND_DIMENSIONS.symbolHeight}
      height={height}
      accessible={!decorative}
      accessibilityRole="image"
      accessibilityLabel={decorative ? undefined : BRAND_TEXT.label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
    />
  );
}
