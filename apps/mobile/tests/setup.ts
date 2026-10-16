jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual<Record<string, unknown>>(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

jest.mock('expo-router/build/react-navigation/core/usePreventRemove', () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);
