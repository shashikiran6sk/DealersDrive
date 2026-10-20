import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { Icon } from '../icon';
import { ActionButton } from '../action-button';

export function EmptyState({
  title,
  description,
  action,
  onAction,
  icon = 'search',
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  icon?: 'search' | 'heart' | 'location';
}) {
  return (
    <View style={styles.root}>
      <View style={styles.icon}>
        <Icon name={icon} size={28} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
      {action && onAction ? (
        <ActionButton variant="secondary" label={action} onPress={onAction} />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { padding: spacing.lg, gap: 14, backgroundColor: colors.page, borderRadius: 16 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: typography.family, fontWeight: '800', fontSize: 22, color: colors.ink },
  description: {
    fontFamily: typography.family,
    fontWeight: '500',
    fontSize: 15,
    color: colors.muted,
    lineHeight: 23,
  },
});
