import type { StorybookConfig } from '@storybook/nextjs-vite';

/**
 * The sandbox is a separate workspace, deliberately.
 *
 * Stories must not live under `apps/web`: that app's `tsconfig.json` includes
 * `**\/*.tsx` and its `next.config.ts` sets `typescript: { ignoreBuildErrors:
 * false }`, so one broken story would fail the production image build. Keeping
 * them here means a story can never break a deploy.
 *
 * It reads components from `apps/web/src` through the `@` alias below — the
 * sandbox displays the real components, never copies of them.
 */
const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) => {
    viteConfig.resolve ??= {};
    viteConfig.resolve.alias = {
      ...viteConfig.resolve.alias,
      '@': new URL('../../web/src', import.meta.url).pathname,
    };
    return viteConfig;
  },
};

export default config;
