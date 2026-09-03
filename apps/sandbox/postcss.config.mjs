/**
 * Tailwind, for the sandbox's own Vite build.
 *
 * `preview.tsx` imports the real `apps/web/src/styles/globals.css`, whose first
 * line is `@import 'tailwindcss'`. Vite resolves a PostCSS config against *its*
 * root, which is `apps/sandbox` — not against the file being imported — so
 * without this file that import never expands and every story renders with no
 * styles at all. The version is pinned to `apps/web`'s, because the two must
 * process the same sheet identically or the sandbox stops being evidence.
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
