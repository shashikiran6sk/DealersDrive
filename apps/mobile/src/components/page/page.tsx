import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

export interface PageProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function Page({ title, description, children }: PageProps) {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <View style={styles.children}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: {
    color: colors.ink,
    fontFamily: typography.family,
    fontSize: typography.title,
    fontWeight: '800',
  },
  description: {
    color: colors.muted,
    fontFamily: typography.family,
    fontSize: typography.body,
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  children: { marginTop: spacing.lg, gap: spacing.md },
});
