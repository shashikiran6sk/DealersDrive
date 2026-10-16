module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm/|((jest-)?react-native|@react-native|@react-navigation|expo|expo-.*|@expo|@dealers-drive|@tanstack|react-native-.*|test-renderer|zod)(/|$))',
  ],
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
};
