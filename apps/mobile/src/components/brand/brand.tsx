import { StyleSheet, View } from 'react-native';

import { BrandSymbol } from './brand-symbol';
import { BrandWordmark } from './brand-wordmark';
import { BRAND_DIMENSIONS, BRAND_TEXT } from './brand.constants';
import type { BrandAssetProps } from './brand.types';

export function Brand({ surface = 'light' }: Pick<BrandAssetProps, 'surface'>) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={BRAND_TEXT.label}
      style={styles.brand}
    >
      <BrandSymbol surface={surface} decorative />
      <BrandWordmark surface={surface} decorative />
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: BRAND_DIMENSIONS.gap },
});
