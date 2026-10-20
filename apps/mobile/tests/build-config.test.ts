import { buildConfig } from '../config/build-config.cjs';
const base = {
  name: 'Dealers-Drive',
  slug: 'dealers-drive-customer',
  android: { allowBackup: false },
};
const preview = {
  EXPO_PUBLIC_APP_ENV: 'preview',
  EXPO_PUBLIC_API_BASE_URL: 'https://api.validation.invalid',
  EXPO_PUBLIC_WEB_BASE_URL: 'https://web.validation.invalid',
};

test('separates development and preview identities without creating a production package', () => {
  expect(buildConfig(base, {}).android.package).toBe('com.dealersdrive.customer.dev');
  expect(buildConfig(base, preview).android.package).toBe('com.dealersdrive.customer.preview');
  expect(buildConfig(base, preview).android.allowBackup).toBe(false);
});

test.each([
  { ...preview, EXPO_PUBLIC_API_BASE_URL: 'http://example.com' },
  { ...preview, EXPO_PUBLIC_WEB_BASE_URL: 'https://user:secret@example.com' },
  { ...preview, APP_ANDROID_VERSION_CODE: '1.5' },
  { ...preview, APP_LINK_HOST: 'unrelated.invalid' },
  { ...preview, EXPO_PUBLIC_APP_ENV: 'production' },
  { ...preview, EXPO_PUBLIC_APP_ENV: 'preview-typo' },
])('rejects unsafe or incomplete build configuration', (env) => {
  expect(() => buildConfig(base, env)).toThrow();
});

test('production requires explicit approval, identity, origins, link host and version', () => {
  const approved = {
    ...preview,
    EXPO_PUBLIC_APP_ENV: 'production',
    APP_RELEASE_APPROVED: 'true',
    APP_ANDROID_PACKAGE: 'com.example.customer',
    APP_ANDROID_VERSION_CODE: '3',
    APP_LINK_HOST: 'web.validation.invalid',
  };
  expect(buildConfig(base, approved).android.versionCode).toBe(3);
  expect(buildConfig(base, approved).android.intentFilters?.[0]?.autoVerify).toBe(true);
  expect(() =>
    buildConfig(base, { ...approved, APP_ANDROID_PACKAGE: 'com.example.dev' }),
  ).toThrow();
  expect(() => buildConfig(base, { ...approved, APP_ANDROID_VERSION_CODE: '' })).toThrow();
});
