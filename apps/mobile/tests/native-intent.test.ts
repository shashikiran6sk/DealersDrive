import type * as LocationModule from '../src/features/location/location';
import { redirectSystemPath } from '../app/+native-intent';

jest.mock('../src/services/environment', () => ({
  publicEnvironment: () => ({ webBaseUrl: 'https://web.validation.invalid' }),
}));

it.each([
  ['dealersdrive://car/missing-release-validation-car', 'car/missing-release-validation-car'],
  ['dealersdrive:///dealers/sri-motors', 'dealers/sri-motors'],
  ['/car/swift', 'car/swift'],
  ['dealersdrive://saved', '(tabs)/saved'],
  ['dealersdrive://admin', ''],
  ['https://evil.invalid/car/swift', ''],
  ['/cars?token=secret', ''],
])(
  'preserves safe intent %s through React Native and the installed Router extractor',
  (path, expected) => {
    const original = global.URL;
    const { URL: nativeUrl } = jest.requireActual<{ URL: typeof URL }>(
      'react-native/Libraries/Blob/URL',
    );
    const { extractExpoPathFromURL } = jest.requireActual<{
      extractExpoPathFromURL: (prefixes: string[], url: string) => string;
    }>('expo-router/build/fork/extractPathFromURL');
    try {
      global.URL = nativeUrl;
      for (const initial of [false, true]) {
        const mapped = redirectSystemPath({ path, initial });
        expect(extractExpoPathFromURL([], mapped)).toBe(expected);
      }
    } finally {
      global.URL = original;
    }
  },
);
it('keeps the saved district when a link names none, and adopts one that does', () => {
  const { locationStore } = jest.requireActual<typeof LocationModule>(
    '../src/features/location/location',
  );
  locationStore.setState({ district: 'vellore', revision: 1, hydrated: true });
  redirectSystemPath({ path: '/cars', initial: true });
  expect(locationStore.getState()).toMatchObject({ district: 'vellore', revision: 1 });
  redirectSystemPath({ path: '/cars?district=vellore', initial: false });
  expect(locationStore.getState().revision).toBe(1);
  redirectSystemPath({ path: '/dealers?district=ranipet', initial: false });
  expect(locationStore.getState()).toMatchObject({ district: 'ranipet', revision: 2 });
});
