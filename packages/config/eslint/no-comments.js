/**
 * Source carries no prose (CLAUDE.md §4b) — the reasoning lives under
 * `docs/code`, on a page mirroring the source path.
 *
 * Opted into per app rather than set in the base preset: it applies to the three
 * apps, and `packages/contracts` is a specification that reads as one.
 */
export function noCommentsInSrc(files = ['src/**/*.{ts,tsx}']) {
  return { files, rules: { 'dealers-drive/no-comments': 'error' } };
}

export default noCommentsInSrc;
