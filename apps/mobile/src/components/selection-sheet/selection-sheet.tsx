import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { Icon } from '../icon';

export interface SelectionOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}
export function SelectionSheet({
  title,
  options,
  value,
  onSelect,
  onClose,
  pending = false,
  error,
  retry,
  searchable = false,
}: {
  title: string;
  options: readonly SelectionOption[];
  value?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  pending?: boolean;
  error?: string | null;
  retry?: () => void;
  searchable?: boolean;
}) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const filtered = options.filter((option) =>
    `${option.label} ${option.description ?? ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <Modal
      testID="selection-sheet"
      transparent
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior="height">
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss selection"
          onPress={onClose}
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.close}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          {searchable ? (
            <TextInput
              accessibilityLabel={`Search ${title.toLowerCase()}`}
              placeholder="Search"
              value={search}
              onChangeText={setSearch}
              style={styles.search}
              autoCorrect={false}
            />
          ) : null}
          {pending ? (
            <ActivityIndicator
              accessibilityLabel="Loading options"
              color={colors.ink}
              style={styles.message}
            />
          ) : error ? (
            <View style={styles.message}>
              <Text accessibilityRole="alert" style={styles.text}>
                {error}
              </Text>
              {retry ? (
                <Pressable accessibilityRole="button" onPress={retry} style={styles.close}>
                  <Text style={styles.text}>Try again</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListEmptyComponent={<Text style={styles.message}>No matching options</Text>}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: value === item.value, disabled: item.disabled }}
                  disabled={item.disabled}
                  style={styles.option}
                  onPress={() => onSelect(item.value)}
                >
                  <View style={[styles.radio, value === item.value && styles.checked]} />
                  <View style={styles.label}>
                    <Text style={[styles.text, item.disabled && styles.disabled]}>
                      {item.label}
                    </Text>
                    {item.description ? (
                      <Text style={styles.description}>{item.description}</Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  title: {
    flex: 1,
    fontFamily: typography.family,
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  search: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.md,
    padding: 14,
    minHeight: 48,
    fontFamily: typography.family,
    color: colors.ink,
    marginVertical: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  label: { flex: 1, gap: 4 },
  text: { fontFamily: typography.family, fontSize: 16, color: colors.ink },
  description: { fontFamily: typography.family, fontSize: 13, color: colors.muted },
  disabled: { color: colors.muted },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.muted },
  checked: { borderWidth: 6, borderColor: colors.ink },
  message: { padding: spacing.lg, fontFamily: typography.family, color: colors.muted },
});
