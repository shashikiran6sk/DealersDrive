# Component sandbox

Local-only. `pnpm sandbox` → http://localhost:6006

It displays the **real** components from `apps/web/src` through the `@` alias —
never copies. A component rendered here is the one the product ships.

## Why it is a separate workspace

Stories must not live under `apps/web`. That app's `tsconfig.json` includes
`**/*.tsx` and its `next.config.ts` sets `typescript: { ignoreBuildErrors:
false }`, so a single broken story would fail the production image build.

## Isolation

| Requirement                       | How                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Different port                    | 6006, verified unused across the repo                                            |
| Separate process                  | started only by `pnpm sandbox`                                                   |
| Not started by the web app or API | `sandbox` is **not** in `turbo.json`'s `dev` task, so `pnpm dev` never starts it |
| Not required for either to run    | nothing in `apps/web` or `apps/api` imports it                                   |
| Never deployed                    | no Dockerfile, not in any workflow; `storybook-static/` is gitignored            |
| No production data                | mock fixtures only, parsed through `packages/contracts`                          |

## Adding a component

1. Add its entry to `src/registry.ts` — including every alias someone might
   search for.
2. Add `src/stories/<category>/<name>.stories.tsx`.
3. Expose every prop the component actually declares as a control. Never invent
   one it does not support.
4. Render the states that exist: empty, error, loading, disabled, long text.

An entry without a story, or a story without an entry, is a gap.
