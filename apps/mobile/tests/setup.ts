jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual<Record<string, unknown>>(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

jest.mock('expo-router/react-navigation', () => ({
  ...jest.requireActual<Record<string, unknown>>('expo-router/react-navigation'),
  usePreventRemove: jest.fn(),
}));

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);
