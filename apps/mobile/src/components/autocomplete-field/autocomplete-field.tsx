import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { Icon } from '../icon';
import { useOverlay } from '../overlay-host';
import { MatchedLabel } from './matched-label';

export interface AutocompleteOption {
  key: string;
  label: string;
  description: string;
}
export function AutocompleteField({
  label,
  placeholder,
  value,
  onChange,
  focused,
  onFocusChange,
  options,
  pending,
  error,
  retry,
  onSelect,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  options: readonly AutocompleteOption[];
  pending: boolean;
  error?: string;
  retry: () => void;
  onSelect: (key: string) => void;
  onSubmit?: () => void;
}) {
  const field = useRef<View>(null);
  const input = useRef<TextInput>(null);
  const owner = useId();
  const overlay = useOverlay();
  const dimensions = useWindowDimensions();
  const [anchor, setAnchor] = useState({ x: 16, y: 0, width: 0, height: 56 });
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = useCallback(() => {
    onFocusChange(false);
    input.current?.blur();
    Keyboard.dismiss();
  }, [onFocusChange]);
  const measure = useCallback(
    () =>
      field.current?.measureInWindow((x, y, width, height) =>
        setAnchor((previous) =>
          previous.x === x &&
          previous.y === y &&
          previous.width === width &&
          previous.height === height
            ? previous
            : { x, y, width, height },
        ),
      ),
    [],
  );
  const open = focused && value.trim().length > 0;
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardTop(event.endCoordinates.screenY);
      measure();
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardTop(null);
      onFocusChange(false);
    });
    return () => {
      shown.remove();
      hidden.remove();
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, [measure, onFocusChange]);
  useEffect(() => {
    if (!open) return;
    measure();
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => back.remove();
  }, [open, close, measure, dimensions.height, dimensions.width]);
  useEffect(() => {
    if (!overlay || !open || !anchor.width) {
      overlay?.hide(owner);
      return;
    }
    const top = anchor.y + anchor.height + 6;
    const maxHeight = Math.max(80, Math.min(300, (keyboardTop ?? dimensions.height) - top - 12));
    const panel = (
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss suggestions"
          onPress={close}
          style={[styles.backdrop, { height: anchor.y }]}
        />
        <Pressable
          accessible={false}
          onPress={close}
          style={[styles.backdrop, { top: anchor.y, width: anchor.x, height: anchor.height }]}
        />
        <Pressable
          accessible={false}
          onPress={close}
          style={[
            styles.backdrop,
            { top: anchor.y, left: anchor.x + anchor.width, right: 0, height: anchor.height },
          ]}
        />
        <Pressable
          accessible={false}
          onPress={close}
          style={[styles.backdrop, { top: anchor.y + anchor.height, bottom: 0 }]}
        />
        <View
          testID="autocomplete-panel"
          style={[
            styles.panel,
            { position: 'absolute', top, left: anchor.x, width: anchor.width, maxHeight },
          ]}
        >
          {pending ? (
            <View style={styles.state}>
              <ActivityIndicator color={colors.ink} />
              <Text style={styles.secondary}>Finding matches…</Text>
            </View>
          ) : error ? (
            <View style={styles.state}>
              <Text accessibilityRole="alert" style={styles.secondary}>
                {error}
              </Text>
              <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
                <Text style={styles.primary}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled>
              {options.length ? (
                options.map((option) => (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label}. ${option.description}`}
                    onPress={() => {
                      onSelect(option.key);
                      close();
                    }}
                    style={styles.option}
                  >
                    <Text style={styles.primary}>
                      <MatchedLabel label={option.label} search={value.trim()} />
                    </Text>
                    <Text style={styles.secondary}>{option.description}</Text>
                  </Pressable>
                ))
              ) : (
                <Text accessibilityLiveRegion="polite" style={styles.state}>
                  No matches. Try a different name.
                </Text>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    );
    overlay.show(owner, panel);
    return () => overlay.hide(owner);
  }, [
    overlay,
    open,
    owner,
    anchor,
    dimensions.height,
    keyboardTop,
    options,
    pending,
    error,
    retry,
    onSelect,
    close,
    value,
  ]);
  return (
    <View ref={field} collapsable={false} onLayout={measure} style={styles.field}>
      <Icon name="search" size={20} color={colors.muted} />
      <TextInput
        ref={input}
        accessibilityLabel={label}
        accessibilityHint="Choose a suggestion to continue."
        accessibilityState={{ expanded: open }}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
        maxLength={120}
        multiline={false}
        numberOfLines={1}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType={onSubmit ? 'search' : 'done'}
        onChangeText={onChange}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          onFocusChange(true);
          measure();
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => onFocusChange(false), 120);
        }}
        onSubmitEditing={() => {
          onSubmit?.();
          close();
        }}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => {
            onChange('');
            input.current?.focus();
          }}
          style={styles.clear}
        >
          <Icon name="close" size={19} />
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  field: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 14,
    backgroundColor: colors.page,
  },
  input: {
    flex: 1,
    minHeight: 54,
    minWidth: 0,
    paddingHorizontal: 10,
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '500',
  },
  clear: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  backdrop: { position: 'absolute', left: 0, right: 0 },
  panel: {
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 14,
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    overflow: 'hidden',
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: 60,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  primary: { fontFamily: typography.family, color: colors.ink, fontSize: 15, fontWeight: '600' },
  secondary: { fontFamily: typography.family, color: colors.muted, fontSize: 13, lineHeight: 19 },
  state: {
    padding: spacing.md,
    gap: spacing.sm,
    fontFamily: typography.family,
    color: colors.muted,
    fontSize: 14,
  },
  retry: { minHeight: 48, justifyContent: 'center' },
});
