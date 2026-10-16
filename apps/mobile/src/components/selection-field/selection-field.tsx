import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { Icon } from '../icon';

export function SelectionField({
  label,
  value,
  placeholder,
  onPress,
  disabled = false,
  expanded = false,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  expanded?: boolean;
}) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityState={{ disabled, expanded }}
        disabled={disabled}
        onPress={onPress}
        style={styles.field}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>{value || placeholder}</Text>
        <Icon name="chevron" size={18} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  label: { fontFamily: typography.family, fontSize: 14, fontWeight: '700', color: colors.ink },
  field: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    padding: 14,
  },
  value: { flex: 1, fontFamily: typography.family, fontSize: 15, color: colors.ink },
  placeholder: { color: colors.muted },
});
