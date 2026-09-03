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
    /**
     * The array form, and the order in it is load-bearing: `find` is a prefix
     * match, so the exact server-actions entry has to be tried before the bare
     * `@`, which would otherwise swallow it.
     *
     * The stub is coupling C-4 from `component-map.md` — `AdminLoginForm` and
     * `SignOutButton` call Server Actions, and the sandbox has no server. See
     * `src/mocks/auth-actions.ts`.
     */
    viteConfig.resolve.alias = [
      {
        find: '@/features/auth/actions',
        replacement: new URL('../src/mocks/auth-actions.ts', import.meta.url).pathname,
      },
      { find: '@', replacement: new URL('../../web/src', import.meta.url).pathname },
    ];
    return viteConfig;
  },
};

export default config;
