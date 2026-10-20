import { StyleSheet, View } from 'react-native';

import { BrandSymbol } from './brand-symbol';
import { BrandWordmark } from './brand-wordmark';
import { BRAND_DIMENSIONS, BRAND_TEXT } from './brand.constants';
import type { BrandAssetProps } from './brand.types';

export function Brand({
  surface = 'light',
  compact = false,
}: Pick<BrandAssetProps, 'surface'> & { compact?: boolean }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={BRAND_TEXT.label}
      style={[styles.brand, compact && styles.compact]}
    >
      <BrandSymbol surface={surface} height={compact ? 22 : undefined} decorative />
      <BrandWordmark surface={surface} width={compact ? 120 : undefined} decorative />
    </View>
  );
}

const styles = StyleSheet.create({
  compact: { gap: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: BRAND_DIMENSIONS.gap },
});
