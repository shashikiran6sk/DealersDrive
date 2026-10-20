import { StyleSheet, Text, View } from 'react-native';
import { CARS_TEXT } from '../../features/cars/cars.constants';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { MAX_GALLERY_DOTS, VIEWER_TEXT } from './photo-gallery.constants';

export function GalleryIndicator({
  index,
  total,
  tone = 'inline',
}: {
  index: number;
  total: number;
  tone?: 'inline' | 'viewer';
}) {
  if (total < 2) return null;
  const viewer = tone === 'viewer';
  return (
    <View
      testID="gallery-indicator"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={styles.row}
    >
      {total <= MAX_GALLERY_DOTS ? (
        <View style={styles.dots}>
          {Array.from({ length: total }, (_unused, dot) => (
            <View
              key={dot}
              testID={dot === index ? 'gallery-dot-active' : 'gallery-dot'}
              style={[
                styles.dot,
                viewer ? styles.viewerDot : null,
                dot === index ? (viewer ? styles.viewerActive : styles.active) : null,
              ]}
            />
          ))}
        </View>
      ) : null}
      <Text style={[styles.counter, viewer ? styles.viewerCounter : null]}>
        {CARS_TEXT.photoCounter(index, total)}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 24,
  },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: radii.pill, backgroundColor: colors.divider },
  active: { width: 18, backgroundColor: colors.ink },
  viewerDot: { backgroundColor: 'rgba(255,255,255,0.35)' },
  viewerActive: { width: 18, backgroundColor: VIEWER_TEXT },
  counter: {
    marginLeft: 'auto',
    fontFamily: typography.family,
    fontSize: 12,
    fontWeight: '700',
    color: colors.page,
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  viewerCounter: { color: VIEWER_TEXT, backgroundColor: 'rgba(255,255,255,0.14)' },
});
