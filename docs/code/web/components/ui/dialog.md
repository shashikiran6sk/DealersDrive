# web / components/ui/dialog

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/ui/dialog/dialog-description.tsx`

### `export function DialogDescription(`

The supporting line, and the dialog's `aria-describedby`.

## `apps/web/src/components/ui/dialog/dialog-title.tsx`

### `export function DialogTitle({ children, className }: { children: ReactNode; className?: string })`

The dialog's accessible name, and 16px/600 heading per §2.14. Exported
because a custom `header` still has to carry it: Radix points
`aria-labelledby` at this element.

## `apps/web/src/components/ui/dialog/dialog.tsx`

### `export function Dialog(`

DESIGN-SPEC §2.14 — the modal dialog, and the product's only 7px radius.

Radix underneath because the list of things a modal has to get right is
longer than it looks and every item on it is a bug only a screen-reader user
hits: focus into the panel, focus trapped, focus back on the trigger however
it closed, `aria-modal` with the rest of the document inert, body scroll
locked. What this component owns is the design — the backdrop tint, the 7px
corner and the one shadow (§4.1).

Width is a default, not a rule: §2.14's `min(440px, 100%)` is right for a
confirmation, and a dialog whose content is a grid overrides it via
`className`. Open state is the caller's, because most dialogs close for a
reason of their own rather than because somebody pressed ✕.

### `aria-modal="true"`

Radix makes the document inert with `aria-hidden` and does not set this itself.

### `'fixed top-1/2 left-1/2 z-71 max-w-[calc(100vw-28px)] -translate-x-1/2 -translate-y-1/2'`

The panel centres itself: Radix portals overlay and content as
siblings, so `place-items:center` on the backdrop never reaches it,
and the backdrop's `z-index:70` would otherwise paint over a panel
at `auto`. `calc(100vw - 28px)` is §2.14's 13.6px edge padding.

### `'dialog max-h-[calc(100svh-28px)] gap-0 overflow-hidden p-0'`

`svh` not `vh`: on a phone the browser chrome is part of `vh`, so a
dialog sized to it puts its own footer under the address bar.

### `<RadixDialog.Close`

Icon-only, so it needs a name (§4.15); 36×36 is the 44px minimum's nearest legal size.

## `apps/web/src/components/ui/dialog/dialog.types.ts`

### `trigger: ReactNode`

The control that opens it, rendered as-is through `Trigger asChild`. It has
to go through Radix: a modal `Content` restores focus to _its trigger_, so a
dialog opened by a button Radix does not know about closes with focus on
`<body>` and the next Tab starts from the top of the document.

### `title: string`

The accessible name. Rendered visibly unless `header` replaces it.

### `description?: string`

Optional supporting line under the title, and the accessible description.

### `closeLabel?: string`

The icon-only close button's `aria-label` — §4.15 requires one.

### `className?: string`

Overrides on the panel: width, padding, layout.

### `contentClassName?: string`

The scrolling region between header and footer.

### `header?: ReactNode`

Replaces the default title block. It still has to _contain_ the title —
pass `<DialogTitle>` — because `aria-labelledby` points at it.

### `footer?: ReactNode`

Pinned below the scrolling region.
