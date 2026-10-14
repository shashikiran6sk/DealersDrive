import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';

export interface AuthFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  prefix?: string;
}
export function AuthField({ label, error, prefix, ...props }: AuthFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          style={styles.input}
          {...props}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: {
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    minHeight: 52,
    backgroundColor: colors.page,
  },
  input: {
    flex: 1,
    padding: spacing.md,
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: typography.body,
  },
  prefix: {
    paddingLeft: spacing.md,
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: typography.body,
  },
  error: { fontFamily: typography.family, color: colors.ink, fontSize: 14 },
});
