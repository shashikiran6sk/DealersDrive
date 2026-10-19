import { baseConfig } from '@dealers-drive/config/eslint/base';

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
  { ignores: ['.expo/**', 'dist/**', 'android/**'] },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        URL: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  { files: ['**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@dealers-drive/contracts',
              message: 'Use an explicit platform-neutral contract subpath.',
            },
          ],
          patterns: [
            'next',
            'next/*',
            'node:*',
            '@prisma/*',
            '@dealers-drive/api',
            '@dealers-drive/web',
          ],
        },
      ],
      'dealers-drive/no-comments': 'error',
    },
  },
];
