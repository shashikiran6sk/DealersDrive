import { nextConfig } from '@dealers-drive/config/eslint/next';

export default [
  ...nextConfig({ tsconfigRootDir: import.meta.dirname }),
  { ignores: ['storybook-static/**'] },
];
