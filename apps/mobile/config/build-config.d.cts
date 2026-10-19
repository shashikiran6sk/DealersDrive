import type { ExpoConfig } from 'expo/config';
export function buildConfig(
  config: ExpoConfig,
  env: Record<string, string | undefined>,
): ExpoConfig & { android: NonNullable<ExpoConfig['android']> };
