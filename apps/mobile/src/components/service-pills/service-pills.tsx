import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { distinctServices } from './utils';

export function ServicePills({ services, label }: { services: readonly string[]; label: string }) {
  const shown = distinctServices(services);
  if (!shown.length) return null;
  return (
    <View accessibilityRole="list" accessibilityLabel={label} style={styles.row}>
      {shown.map((service) => (
        <View key={service} style={styles.pill}>
          <Text style={styles.text} numberOfLines={2}>
            {service}
          </Text>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 13, fontWeight: '600' },
});
