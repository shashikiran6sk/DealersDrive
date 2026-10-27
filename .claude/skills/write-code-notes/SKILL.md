---
name: write-code-notes
description: Record why code is the way it is in docs/code instead of a source comment — find the page mirroring the source path, add a heading naming the declaration, and write the reasoning. Use whenever a change would have wanted a comment, when a decision or bug fix needs explaining, or when lint reports dealers-drive/no-comments.
---

# Write the reasoning in docs/code, not in a comment

`src` carries no prose (`AGENTS.md` §4b). `dealers-drive/no-comments` is an
ESLint error on `src/**`; the only comments allowed are toolchain directives
(`eslint-disable…`, `@ts-expect-error`, `prettier-ignore`, coverage pragmas).

**Why** a piece of code exists lives in `docs/code/**`, on a page addressed by
the source path. Read the page before changing a file, and update it in the
same PR when the reasoning changes.

## 1. Find the page

`docs/code` mirrors the source tree. Walk down from
[`docs/code/README.md`](../../../docs/code/README.md):

| Source                                             | Page                                               |
| -------------------------------------------------- | -------------------------------------------------- |
| `apps/api/src/modules/search/search.repository.ts` | `docs/code/api/modules/search.md`                  |
| `apps/api/src/platform/…`                          | `docs/code/api/platform/…` or `platform.md`        |
| `apps/web/src/components/vehicle/vehicle-card/…`   | `docs/code/web/components/vehicle/vehicle-card.md` |
| `apps/web/src/app/(public)/cars/page.tsx`          | `docs/code/web/app/(public)/cars.md`               |
| `apps/sandbox/src/…`                               | `docs/code/sandbox/…`                              |

`git grep -l "<file name>" docs/code` finds it fastest. If a folder has no
page yet, create one and link it from its parent's `README.md`.

## 2. The shape of a page

```markdown
# web / components/vehicle/vehicle-card

Parent: [web/components/vehicle](README.md)

## `apps/web/src/components/vehicle/vehicle-card/vehicle-card.tsx`

### `export function VehicleCard({ vehicle, priority, className }: VehicleCardProps)`

Why it is a server component, why the whole card is the link, … (**F075**).
```

- `##` — the source file's full path, in backticks.
- `###` — the declaration, written as it appears in the code.
- Under it: the reasoning. Cite the ticket in bold — `**F075**`, `**R71**`,
  `**BUG-113**`, `**UPD-2**` — and `DESIGN-SPEC §n` for design decisions.

## 3. What belongs there

Write what the code cannot say: the constraint, the bug it prevents, the
alternative rejected and why, the invariant it upholds. Not a restatement of
what the code does.

Before writing, look again at the code: half of what wanted a comment wanted a
named constant or a smaller function instead (§4b's constants and helpers).

## 4. Check

- `pnpm format:check` — the pages are Prettier-formatted Markdown.
- `pnpm lint` — confirms no comment slipped into `src`.
