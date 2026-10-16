jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual<Record<string, unknown>>(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);
