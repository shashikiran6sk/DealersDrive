import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import manrope from '../src/assets/Manrope.ttf';
import { AppProviders } from '../src/features/providers/app-providers';
import { colors } from '../src/theme/tokens';
import { typography } from '../src/theme/tokens';
import { NavigationBack } from '../src/components/navigation-back';
import { Brand } from '../src/components/brand';
import { stackTitle } from '../src/features/navigation/stack-titles';

export { AppErrorBoundary as ErrorBoundary } from '../src/features/reliability/app-error-boundary';
export const unstable_settings = { initialRouteName: '(tabs)' };

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded, error] = useFonts({ Manrope: manrope });
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack
        screenOptions={({ route }) => ({
          title: stackTitle(route.name, route.params),
          headerShown: true,
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.page },
          headerTitleStyle: { fontFamily: typography.family, fontSize: 17, fontWeight: '700' },
          contentStyle: { backgroundColor: colors.page },
          headerLeft: () => (
            <NavigationBack
              close={route.name === 'sign-in'}
              fallback={route.name === 'car/[slug]' ? '/cars' : '/'}
              testID={route.name === 'car/[slug]' ? 'car-details-back' : undefined}
            />
          ),
        })}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="sign-in"
          options={{ presentation: 'modal', headerTitle: () => <Brand /> }}
        />
      </Stack>
    </AppProviders>
  );
}
