import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { Icon } from '../icon';

export function NavigationBack({
  close = false,
  fallback = '/',
  testID,
}: {
  close?: boolean;
  fallback?: Href;
  testID?: string;
}) {
  const router = useRouter();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={close ? 'Close' : 'Back'}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      style={styles.button}
    >
      <Icon name={close ? 'close' : 'back'} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
});
