import type { ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../../components/action-button';
import { colors, spacing, typography } from '../../../theme/tokens';
import { RELIABILITY_TEXT } from '../reliability.constants';

export function AppErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={styles.title}>
        {RELIABILITY_TEXT.failed}
      </Text>
      <Text accessibilityRole="alert" style={styles.body}>
        {RELIABILITY_TEXT.recovery}
      </Text>
      <ActionButton label={RELIABILITY_TEXT.retry} onPress={() => void retry()} />
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.page,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: { color: colors.ink, fontFamily: typography.family, fontSize: 24, fontWeight: '700' },
  body: { color: colors.ink, fontFamily: typography.family, fontSize: 16, lineHeight: 24 },
});
