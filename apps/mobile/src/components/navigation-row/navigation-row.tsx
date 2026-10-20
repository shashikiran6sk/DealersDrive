import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../theme/tokens';
import { Icon } from '../icon';

export function NavigationRow({
  label,
  description,
  onPress,
}: {
  label: string;
  description?: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <View style={styles.label}>
        <Text style={styles.text}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Icon name="forward" size={17} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.page,
  },
  label: { flex: 1, gap: 4 },
  text: { fontFamily: typography.family, fontSize: 15, color: colors.ink, fontWeight: '600' },
  description: { fontFamily: typography.family, fontSize: 13, lineHeight: 19, color: colors.muted },
});
