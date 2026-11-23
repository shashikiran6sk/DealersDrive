import { baseConfig } from '@dealers-drive/config/eslint/base';
import { noCommentsInSrc } from '@dealers-drive/config/eslint/no-comments';
import globals from 'globals';

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  noCommentsInSrc(),
  { ignores: ['out/**', '.cache/**'] },
];
