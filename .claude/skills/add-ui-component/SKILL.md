---
name: add-ui-component
description: Find, reuse, extend or create a React component in apps/web — search the sandbox registry first, follow the one-folder-per-component layout, keep text in constants, and add the sandbox registry entry and Storybook story. Use for any UI change that renders a component.
---

# Add or change a UI component

Read `AGENTS.md` §2 steps 2–4, §4b (components, helpers, constants, types) and
§6 (the UI definition of done) first. The rule that matters most: **search
before you build.** The sandbox exists because buttons and tables were
re-implemented when the existing ones were too hard to find.

## 1. Search the sandbox

- `apps/sandbox/src/registry.ts` — every component, with `name`, `aliases`,
  `category`, `purpose`, `props`, `states` and its `source` path. Search by
  name, by alias and by what it does.
- `pnpm sandbox` — Storybook on port 6006; look at the candidates running.
- `docs/DESIGN-SPEC.md` — what the product should look like, by section.

Then decide:

| What you found         | Do                                                                           |
| ---------------------- | ---------------------------------------------------------------------------- |
| Exists and fits        | Reuse it                                                                     |
| Exists and nearly fits | Extend it with a prop; check every consumer the registry and `git grep` list |
| Nothing fits           | Create it — and give it a registry entry and a story in the same PR          |

## 2. Where it goes

```
apps/web/src/components/<area>/<component-name>/
  index.ts                       the barrel callers import
  <component-name>.tsx           the component, and nothing else
  <component-name>.constants.ts  every user-facing string, limit and lookup
  <component-name>.types.ts      props past a few fields
  utils.ts                       helpers only this component uses
```

- Shared primitives: `components/ui/`. Feature-only components:
  `apps/web/src/features/<feature>/`.
- A second component in the folder gets its own file, re-exported from
  `index.ts`. `apps/web/src/components/dealers/dealer-card/` is the model.
- Helpers two components use go in `apps/web/src/lib/`; shared types in
  `apps/web/src/types/`; API shapes come from `@dealers-drive/contracts`.
- **No literal user-facing text in a `return`** — labels, placeholders,
  `aria-label`s and messages live in the constants file.
- Server component by default; `'use client'` only for an event handler, a
  browser API or `localStorage`.
- Styling with Tailwind tokens and `cva` variants; Radix for behaviour. Use
  `Button`, `Dialog` and the other primitives in `components/ui/` rather than
  raw elements.
- No comments, no `as`, no `any` (§4b).

## 3. Sandbox entry and story — same PR

Add a `RegistryEntry` to `apps/sandbox/src/registry.ts`:

```ts
{
  id: 'C137',
  name: 'FinalMoveDialog',
  source: 'apps/web/src/features/dealer/enquiries/final-move-dialog.tsx',
  category: 'Console',
  ownership: 'Feature-specific',
  purpose: 'What it is for, in one or two sentences.',
  aliases: ['ConfirmClose', 'ConfirmSpam', 'final-move-dialog'],
  features: ['UPD-2'],
  props: ['to (CLOSED | SPAM)', 'label', 'disabled', 'loading', 'onConfirm'],
  states: ['close', 'spam', 'open', 'moving'],
  reusable: false,
  storyId: 'dealer-finalmovedialog',
},
```

and a story beside the others in `apps/sandbox/src/stories/<area>/`, with the
meaningful props as controls and one story per relevant state. The storyId is
the story's `title` lower-cased with `/` as `-`.

## 4. Tests and verification

- Tests in `apps/web/tests/unit/components/<area>/` (or `features/`), with
  Testing Library — behaviour and accessible names, not markup.
- `pnpm --filter @dealers-drive/web test` and
  `pnpm --filter @dealers-drive/sandbox build:sandbox`, then `verify-change`.
- Look at it in the sandbox by eye, at phone and desktop widths, and attach a
  screenshot to the PR.
- Reasoning goes in the `docs/code/web/…` page mirroring the source path
  (`write-code-notes`).
