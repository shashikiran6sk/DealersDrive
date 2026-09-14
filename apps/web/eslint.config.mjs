import { nextConfig } from '@dealers-drive/config/eslint/next';
import { noCommentsInSrc } from '@dealers-drive/config/eslint/no-comments';

export default [...nextConfig({ tsconfigRootDir: import.meta.dirname }), noCommentsInSrc()];
