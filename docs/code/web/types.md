# web / types

Parent: [web](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/types/action-result.ts`

### `export interface ActionResult`

The shape every server action answers a client component with. `AdminResult`
and the dealer actions are structurally this plus whatever payload they carry,
so a component that only needs to know whether it worked takes this.

## `apps/web/src/types/nav.ts`

### `export interface NavItem`

One entry in a console sidebar or tab bar. Shared by the dealer and admin navs.

### `short?: string`

Shown in the bottom tab bar; items without one are desktop-only.
