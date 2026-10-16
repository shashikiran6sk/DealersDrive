import { Pressable, StyleSheet, Text } from 'react-native';
import { CheckBoxMark } from './check-box-mark';
import { colors, spacing, typography } from '../../theme/tokens';

export function ConsentChoice({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onChange}
      style={styles.choice}
    >
      <CheckBoxMark checked={checked} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  choice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1, fontFamily: typography.family, fontSize: typography.body, color: colors.ink },
});
